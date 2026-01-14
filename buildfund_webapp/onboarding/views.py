"""Views for onboarding chatbot and data collection."""
from __future__ import annotations

import uuid
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone

from .models import OnboardingProgress, OnboardingData, OnboardingSession
from .serializers import (
    OnboardingProgressSerializer,
    OnboardingDataSerializer,
    OnboardingSessionSerializer,
    ChatbotMessageSerializer,
)
from .services import OnboardingChatbotService, AddressVerificationService
from verification.services import HMRCVerificationService
from accounts.models import Role, UserRole
from consultants.models import ConsultantProfile


class OnboardingViewSet(viewsets.ViewSet):
    """ViewSet for onboarding chatbot and data collection."""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.chatbot_service = OnboardingChatbotService()
        # Initialize services lazily to avoid errors if API keys are missing
        self._address_service = None
        self._hmrc_service = None
    
    @property
    def address_service(self):
        """Lazy initialization of address service."""
        if self._address_service is None:
            try:
                self._address_service = AddressVerificationService()
            except ValueError as e:
                # If Google API key is missing, create a dummy service that will fail gracefully
                print(f"Warning: AddressVerificationService not available: {e}")
                self._address_service = None
        return self._address_service
    
    @property
    def hmrc_service(self):
        """Lazy initialization of HMRC service."""
        if self._hmrc_service is None:
            try:
                self._hmrc_service = HMRCVerificationService()
            except ValueError as e:
                # If HMRC API key is missing, create a dummy service that will fail gracefully
                print(f"Warning: HMRCVerificationService not available: {e}")
                self._hmrc_service = None
        return self._hmrc_service
    
    @action(detail=False, methods=["get"])
    def progress(self, request):
        """Get current user's onboarding progress."""
        from accounts.models import UserRole
        
        try:
            progress, _ = OnboardingProgress.objects.get_or_create(user=request.user)
            
            # Determine user role and recalculate progress
            user_role = None
            try:
                user_roles = UserRole.objects.filter(user=request.user).select_related("role")
                if user_roles.exists():
                    role_names = [ur.role.name for ur in user_roles]
                    if "Borrower" in role_names:
                        user_role = 'borrower'
                    elif "Lender" in role_names:
                        user_role = 'lender'
                    elif "Consultant" in role_names:
                        user_role = 'consultant'
            except Exception as e:
                print(f"Error determining user role: {e}")
                pass
            
            # Recalculate progress with role-specific logic
            try:
                progress.calculate_progress(user_role=user_role)
            except Exception as e:
                # If calculation fails, return progress with default values
                import traceback
                print(f"Error calculating progress: {e}")
                print(traceback.format_exc())
                # Set safe defaults
                if not hasattr(progress, 'completion_percentage') or progress.completion_percentage is None:
                    progress.completion_percentage = 0
                if not hasattr(progress, 'is_complete'):
                    progress.is_complete = False
                progress.save()
            
            serializer = OnboardingProgressSerializer(progress)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            print(f"Error in progress endpoint: {e}")
            print(traceback.format_exc())
            # Return a safe default response instead of crashing
            return Response({
                "is_complete": False,
                "completion_percentage": 0,
                "current_step": "",
                "profile_complete": False,
                "contact_complete": False,
                "company_complete": False,
                "address_complete": False,
                "financial_complete": False,
                "documents_complete": False,
                "company_verified": False,
                "address_verified": False,
            }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=["get", "post"])
    def chat(self, request):
        """Handle chatbot conversation."""
        user = request.user
        
        # Get or create onboarding progress
        progress, _ = OnboardingProgress.objects.get_or_create(user=user)
        
        # Get user role
        user_roles = UserRole.objects.filter(user=user).select_related("role")
        user_role = "Borrower"  # Default
        if user_roles.exists():
            role_names = [ur.role.name for ur in user_roles]
            if "Lender" in role_names:
                user_role = "Lender"
            elif "Consultant" in role_names:
                user_role = "Consultant"
            elif "Admin" in role_names:
                user_role = "Admin"
        
        if request.method == "GET":
            # Start or resume conversation
            session_id = request.query_params.get("session_id")
            
            if session_id:
                try:
                    session = OnboardingSession.objects.get(session_id=session_id, user=user, is_active=True)
                except OnboardingSession.DoesNotExist:
                    session = None
            else:
                session = OnboardingSession.objects.filter(user=user, is_active=True).first()
            
            if not session:
                # Create new session
                session = OnboardingSession.objects.create(
                    user=user,
                    session_id=str(uuid.uuid4()),
                    current_step=progress.current_step or "welcome",
                )
            
            # Check if there's existing progress
            has_existing_progress = (
                progress.completion_percentage > 0 or
                (session.conversation_history and len(session.conversation_history) > 0)
            )
            
            # Get next question
            steps = self.chatbot_service.get_steps_for_role(user_role)
            current_step_index = steps.index(session.current_step) if session.current_step in steps else 0
            
            if progress.is_complete:
                current_step = "complete"
            else:
                current_step = session.current_step or steps[0]
            
            question_data = self.chatbot_service.get_next_question(
                current_step,
                user_role,
                session.collected_data or {}
            )
            
            if not question_data:
                question_data = {
                    "question": "Thank you! Your profile is complete.",
                    "step": "complete",
                    "type": "text",
                }
            
            # Handle conversation history - show welcome back message if resuming
            conversation_history = list(session.conversation_history) if session.conversation_history else []
            
            if has_existing_progress and conversation_history:
                # Check if welcome back message already exists (to avoid duplicates)
                has_welcome_back = any(
                    msg.get("message", "").startswith("Welcome back") 
                    for msg in conversation_history 
                    if msg.get("type") == "bot"
                )
                
                if not has_welcome_back:
                    # Prepend welcome back message
                    welcome_back_msg = {
                        "type": "bot",
                        "message": f"Welcome back! 👋 You've completed {progress.completion_percentage}% of your profile. Let's continue where we left off.",
                        "timestamp": timezone.now().isoformat(),
                    }
                    conversation_history.insert(0, welcome_back_msg)
                
                # Don't include the current question in history yet - it will be shown by the frontend
                # The frontend will add it to the messages when displaying
            elif not conversation_history:
                # New conversation - add welcome message
                conversation_history = [{
                    "type": "bot",
                    "message": question_data.get("question", "Welcome! Let's get started."),
                    "timestamp": timezone.now().isoformat(),
                }]
            
            return Response({
                "session_id": session.session_id,
                "question": question_data,
                "progress": OnboardingProgressSerializer(progress).data,
                "conversation_history": conversation_history,
                "is_resuming": has_existing_progress,
            })
        
        elif request.method == "POST":
            # Process user response
            serializer = ChatbotMessageSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            message = serializer.validated_data["message"]
            session_id = serializer.validated_data.get("session_id")
            step = serializer.validated_data.get("step", "welcome")
            
            # Get or create session
            if session_id:
                try:
                    session = OnboardingSession.objects.get(session_id=session_id, user=user)
                except OnboardingSession.DoesNotExist:
                    session = OnboardingSession.objects.create(
                        user=user,
                        session_id=session_id,
                        current_step=step,
                    )
            else:
                session = OnboardingSession.objects.filter(user=user, is_active=True).first()
                if not session:
                    session = OnboardingSession.objects.create(
                        user=user,
                        session_id=str(uuid.uuid4()),
                        current_step=step,
                    )
            
            # Update conversation history
            if not session.conversation_history:
                session.conversation_history = []
            session.conversation_history.append({
                "type": "user",
                "message": message,
                "timestamp": timezone.now().isoformat(),
            })
            
            # Process response based on current step
            # Use session.current_step instead of step from request (more reliable)
            current_step = session.current_step or step or "welcome"
            collected_data = session.collected_data or {}
            
            try:
                next_step = self._process_response(current_step, message, collected_data, user_role, progress, user)
            except Exception as e:
                # Log error and return a safe response
                import traceback
                print(f"Error processing response: {e}")
                print(traceback.format_exc())
                return Response({
                    "error": f"Error processing your response: {str(e)}",
                    "session_id": session.session_id,
                    "question": self.chatbot_service.get_next_question(current_step, user_role, collected_data),
                    "progress": OnboardingProgressSerializer(progress).data,
                    "conversation_history": session.conversation_history,
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Update session
            session.current_step = next_step
            session.collected_data = collected_data
            session.last_activity = timezone.now()
            session.save()
            
            # Update progress
            try:
                self._update_progress(progress, collected_data, user_role, user)
            except Exception as e:
                import traceback
                print(f"Error updating progress: {e}")
                print(traceback.format_exc())
                # Continue anyway - progress update failure shouldn't block the response
            
            # Get next question
            try:
                question_data = self.chatbot_service.get_next_question(
                    next_step,
                    user_role,
                    collected_data
                )
            except Exception as e:
                import traceback
                print(f"Error getting next question: {e}")
                print(traceback.format_exc())
                question_data = {
                    "question": "I'm ready for your next response.",
                    "step": next_step,
                    "type": "text",
                }
            
            # Add bot response to conversation
            if question_data:
                session.conversation_history.append({
                    "type": "bot",
                    "message": question_data.get("question", ""),
                    "timestamp": timezone.now().isoformat(),
                })
                session.save()
            
            return Response({
                "session_id": session.session_id,
                "question": question_data,
                "progress": OnboardingProgressSerializer(progress).data,
                "conversation_history": session.conversation_history,
            })
    
    def _process_response(self, step: str, message: str, collected_data: dict, user_role: str, progress: OnboardingProgress, user) -> str:
        """Process user response and update collected data."""
        steps = self.chatbot_service.get_steps_for_role(user_role)
        if not steps:
            return "complete"  # No steps defined, mark as complete
        
        # Safely get current index
        try:
            current_index = steps.index(step) if step in steps else 0
        except (ValueError, AttributeError):
            current_index = 0
            step = steps[0] if steps else "complete"
        
        # Handle special responses
        message_lower = message.lower().strip()
        if message_lower in ["skip", "none", "n/a", "not applicable"]:
            # Skip optional fields
            if current_index < len(steps) - 1:
                return steps[current_index + 1]
            return step
        
        if message_lower in ["yes, let's start", "yes", "ok", "sure", "let's go"]:
            if step == "welcome":
                return steps[1] if len(steps) > 1 else "complete"
        
        if message_lower in ["maybe later", "later", "not now"]:
            return "paused"
        
        # Process step-specific responses
        if step == "profile_name":
            collected_data["first_name"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "profile_last_name":
            collected_data["last_name"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "profile_dob":
            # Parse date (DD/MM/YYYY)
            try:
                from datetime import datetime
                date_obj = datetime.strptime(message, "%d/%m/%Y")
                collected_data["date_of_birth"] = date_obj.strftime("%Y-%m-%d")
            except:
                pass  # Invalid date, will ask again
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "contact_email":
            collected_data["email"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "contact_phone":
            collected_data["phone_number"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "address_collection":
            collected_data["postcode"] = message
            # Use postcode lookup to get address details
            try:
                import requests
                from django.conf import settings
                
                api_key = settings.GOOGLE_API_KEY
                if api_key:
                    # Call Google Geocoding API for postcode lookup
                    url = "https://maps.googleapis.com/maps/api/geocode/json"
                    params = {
                        "address": f"{message}, UK",
                        "key": api_key,
                        "region": "gb",
                    }
                    response = requests.get(url, params=params, timeout=10)
                    response.raise_for_status()
                    data = response.json()
                    
                    if data.get("status") == "OK" and data.get("results"):
                        result = data["results"][0]
                        formatted_address = result.get("formatted_address", "")
                        
                        # Extract address components
                        components = {}
                        for component in result.get("address_components", []):
                            types = component.get("types", [])
                            if "postal_town" in types or "locality" in types:
                                components["town"] = component.get("long_name")
                            elif "administrative_area_level_2" in types:
                                components["county"] = component.get("long_name")
                            elif "postal_code" in types:
                                components["postcode"] = component.get("long_name")
                            elif "country" in types:
                                components["country"] = component.get("long_name")
                            elif "street_number" in types:
                                components["street_number"] = component.get("long_name")
                            elif "route" in types:
                                components["route"] = component.get("long_name")
                        
                        # Store verification data with formatted address
                        collected_data["address_verification_data"] = {
                            "verified": True,
                            "formatted_address": formatted_address,
                            "components": components,
                            "confidence_score": 0.9,
                            "message": "Address found via postcode lookup",
                        }
                        
                        # Store address components in collected_data for later use
                        if components.get("town"):
                            collected_data["town"] = components["town"]
                        if components.get("county"):
                            collected_data["county"] = components["county"]
                        
                        return "address_verification"
                    else:
                        # Postcode lookup failed
                        collected_data["address_verification_data"] = {
                            "verified": False,
                            "formatted_address": None,
                            "message": f"Could not find address for postcode: {data.get('status', 'Unknown error')}",
                        }
                else:
                    # No API key
                    collected_data["address_verification_data"] = {
                        "verified": False,
                        "formatted_address": None,
                        "message": "Address verification service not configured",
                    }
            except Exception as e:
                import traceback
                print(f"Error in postcode lookup: {e}")
                print(traceback.format_exc())
                collected_data["address_verification_data"] = {
                    "verified": False,
                    "formatted_address": None,
                    "message": f"Error looking up address: {str(e)}",
                }
            
            # If we got a formatted address, go to verification step
            if collected_data.get("address_verification_data", {}).get("verified"):
                return "address_verification"
            
            # API failed or no results - fall back to manual address collection
            # Set flag to indicate manual entry is needed
            collected_data["address_manual_entry_required"] = True
            collected_data["address_lookup_failed"] = True
            # Go to address confirmation step to collect address manually
            return "address_confirmation" if "address_confirmation" in steps else (steps[current_index + 1] if current_index < len(steps) - 1 else "complete")
        
        elif step == "address_verification":
            if message_lower in ["yes", "yes, that's correct", "correct", "yes that's correct"]:
                # Use the verified address
                addr_data = collected_data.get("address_verification_data", {})
                components = addr_data.get("components", {})
                collected_data["address_line_1"] = components.get("route", "") or addr_data.get("formatted_address", "").split(",")[0]
                collected_data["town"] = components.get("town", "")
                collected_data["county"] = components.get("county", "")
                collected_data["postcode"] = components.get("postcode", "") or collected_data.get("postcode", "")
                return "address_confirmation" if "address_confirmation" in steps else (steps[current_index + 1] if current_index < len(steps) - 1 else "complete")
            else:
                # User wants to enter manually
                return "address_confirmation" if "address_confirmation" in steps else (steps[current_index + 1] if current_index < len(steps) - 1 else "complete")
        
        elif step == "address_confirmation":
            # Track which address field we're collecting
            address_fields_collected = collected_data.get("address_fields_collected", [])
            
            # Determine which field to collect next
            if "address_line_1" not in address_fields_collected:
                collected_data["address_line_1"] = message
                address_fields_collected.append("address_line_1")
                collected_data["address_fields_collected"] = address_fields_collected
                # Stay on this step to collect next field
                return "address_confirmation"
            elif "address_line_2" not in address_fields_collected:
                # Address line 2 is optional, but we'll ask anyway
                collected_data["address_line_2"] = message if message_lower not in ["skip", "none", "n/a", ""] else ""
                address_fields_collected.append("address_line_2")
                collected_data["address_fields_collected"] = address_fields_collected
                return "address_confirmation"
            elif "town" not in address_fields_collected:
                collected_data["town"] = message
                address_fields_collected.append("town")
                collected_data["address_fields_collected"] = address_fields_collected
                return "address_confirmation"
            elif "county" not in address_fields_collected:
                collected_data["county"] = message
                address_fields_collected.append("county")
                collected_data["address_fields_collected"] = address_fields_collected
                return "address_confirmation"
            elif "postcode" not in address_fields_collected or not collected_data.get("postcode"):
                # Use postcode from address_collection if available, otherwise collect it
                if not collected_data.get("postcode"):
                    collected_data["postcode"] = message
                address_fields_collected.append("postcode")
                collected_data["address_fields_collected"] = address_fields_collected
                return "address_confirmation"
            elif "country" not in address_fields_collected:
                collected_data["country"] = message if message_lower not in ["skip", "none", "n/a", ""] else "United Kingdom"
                address_fields_collected.append("country")
                collected_data["address_fields_collected"] = address_fields_collected
                # All fields collected, move to next step
                return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
            else:
                # All fields collected, move to next step
                return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "company_collection":
            if message_lower not in ["skip", "none", "n/a"]:
                collected_data["company_registration_number"] = message
                # Verify company with Companies House
                if self.hmrc_service:
                    company_name = collected_data.get("company_name", "")
                    verification = self.hmrc_service.verify_company(message, company_name)
                    collected_data["company_verification_data"] = verification
                    
                    # Get directors list from Companies House
                    if verification.get("verified"):
                        company_info = verification.get("company_info", {})
                        company_number = message
                        officers_data = self.hmrc_service.get_company_officers(company_number)
                        if "error" not in officers_data:
                            directors = officers_data.get("items", [])
                            collected_data["company_verification_data"]["directors"] = directors
                            collected_data["company_verification_data"]["company_info"] = company_info
                            return "company_verification"
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "company_verification":
            if message_lower in ["yes", "yes, that's correct", "correct", "yes that's correct"]:
                # Store company name from verification
                comp_data = collected_data.get("company_verification_data", {})
                comp_info = comp_data.get("company_info", {})
                collected_data["company_name"] = comp_info.get("company_name", "")
                return "company_confirmation" if "company_confirmation" in steps else (steps[current_index + 1] if current_index < len(steps) - 1 else "complete")
            else:
                return "company_collection"  # Go back to ask for company number again
        
        elif step == "company_confirmation":
            collected_data["company_name"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "directors_list":
            if message_lower in ["yes", "yes, i'm ready", "ready", "yes i'm ready to provide director details"]:
                # Initialize directors collection
                collected_data["directors_collected"] = []
                directors = collected_data.get("company_verification_data", {}).get("directors", [])
                if directors:
                    return "director_details"  # Start collecting director details
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "director_details":
            # Parse director details: "Name, DOB, Nationality"
            directors_collected = collected_data.get("directors_collected", [])
            directors = collected_data.get("company_verification_data", {}).get("directors", [])
            
            # Parse the input
            parts = [p.strip() for p in message.split(",")]
            director_data = {
                "name": parts[0] if len(parts) > 0 else message,
                "date_of_birth": parts[1] if len(parts) > 1 else None,
                "nationality": parts[2] if len(parts) > 2 else None,
            }
            
            # Verify director with HMRC if service available
            if self.hmrc_service and collected_data.get("company_registration_number"):
                company_number = collected_data["company_registration_number"]
                dob_str = None
                if director_data["date_of_birth"]:
                    try:
                        from datetime import datetime
                        dob_obj = datetime.strptime(director_data["date_of_birth"], "%d/%m/%Y")
                        dob_str = dob_obj.strftime("%Y-%m-%d")
                    except:
                        pass
                
                verification = self.hmrc_service.verify_director(
                    company_number,
                    director_data["name"],
                    dob_str
                )
                director_data["verification"] = verification
            
            directors_collected.append(director_data)
            collected_data["directors_collected"] = directors_collected
            
            # Check if we need to collect more directors
            if len(directors_collected) < len(directors):
                return "director_details"  # Continue collecting
            else:
                # All directors collected, move to next step
                return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        # KYC and Financial Information (Borrowers)
        elif step == "kyc_nationality":
            collected_data["nationality"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "kyc_national_insurance":
            if message_lower not in ["skip", "none", "n/a"]:
                collected_data["national_insurance_number"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "kyc_source_of_funds":
            collected_data["source_of_funds"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "financial_income":
            try:
                collected_data["annual_income"] = float(message.replace(",", "").replace("£", ""))
            except:
                pass
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "financial_employment":
            collected_data["employment_status"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "financial_employment_details":
            if message_lower not in ["skip", "none", "n/a"]:
                # Parse "Company Name, Position"
                parts = [p.strip() for p in message.split(",")]
                collected_data["employment_company"] = parts[0] if len(parts) > 0 else message
                collected_data["employment_position"] = parts[1] if len(parts) > 1 else ""
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "financial_expenses":
            try:
                collected_data["monthly_expenses"] = float(message.replace(",", "").replace("£", ""))
            except:
                pass
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "financial_existing_debts":
            try:
                collected_data["existing_debts"] = float(message.replace(",", "").replace("£", ""))
            except:
                collected_data["existing_debts"] = 0
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "financial_assets":
            try:
                collected_data["total_assets"] = float(message.replace(",", "").replace("£", ""))
            except:
                pass
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        # Asset & Liability Statement
        elif step == "assets_real_estate":
            try:
                collected_data["assets_real_estate"] = float(message.replace(",", "").replace("£", ""))
            except:
                collected_data["assets_real_estate"] = 0
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "assets_investments":
            try:
                collected_data["assets_investments"] = float(message.replace(",", "").replace("£", ""))
            except:
                collected_data["assets_investments"] = 0
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "assets_other":
            try:
                collected_data["assets_other"] = float(message.replace(",", "").replace("£", ""))
            except:
                collected_data["assets_other"] = 0
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "liabilities_mortgages":
            try:
                collected_data["liabilities_mortgages"] = float(message.replace(",", "").replace("£", ""))
            except:
                collected_data["liabilities_mortgages"] = 0
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "liabilities_loans":
            try:
                collected_data["liabilities_loans"] = float(message.replace(",", "").replace("£", ""))
            except:
                collected_data["liabilities_loans"] = 0
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "liabilities_other":
            try:
                collected_data["liabilities_other"] = float(message.replace(",", "").replace("£", ""))
            except:
                collected_data["liabilities_other"] = 0
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "assets_liabilities_summary":
            if message_lower in ["yes", "yes, that's correct", "correct", "yes that's correct"]:
                # Store calculated values
                total_assets = (
                    float(collected_data.get("assets_real_estate", 0) or 0) +
                    float(collected_data.get("assets_investments", 0) or 0) +
                    float(collected_data.get("assets_other", 0) or 0) +
                    float(collected_data.get("total_assets", 0) or 0)
                )
                total_liabilities = (
                    float(collected_data.get("liabilities_mortgages", 0) or 0) +
                    float(collected_data.get("liabilities_loans", 0) or 0) +
                    float(collected_data.get("liabilities_other", 0) or 0) +
                    float(collected_data.get("existing_debts", 0) or 0)
                )
                collected_data["total_assets_calculated"] = total_assets
                collected_data["total_liabilities_calculated"] = total_liabilities
                collected_data["net_worth_calculated"] = total_assets - total_liabilities
                return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
            else:
                # Go back to assets section
                return "assets_real_estate"
        
        elif step == "experience_collection":
            try:
                collected_data["experience_years"] = int(message)
            except:
                pass
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "experience_projects":
            try:
                collected_data["previous_projects"] = int(message)
            except:
                collected_data["previous_projects"] = 0
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "portfolio_current_assets":
            if message_lower not in ["skip", "none", "n/a", "no"]:
                collected_data["portfolio_description"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "portfolio_property_details":
            if message_lower not in ["skip", "none", "n/a", "no"]:
                collected_data["portfolio_property_details"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "funding_type_selection":
            # Store selected funding type
            collected_data["funding_type"] = message
            # Get funding type specific questions
            funding_questions = self.chatbot_service.get_funding_type_specific_questions(message)
            if funding_questions:
                # Store questions to ask
                collected_data["funding_type_questions"] = funding_questions
                collected_data["current_funding_question_index"] = 0
                # Move to first funding-specific question
                return funding_questions[0]["step"]
            else:
                # No additional questions, proceed to documents
                return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        # Handle funding type specific questions dynamically
        elif step.startswith("revenue_based_") or step.startswith("mca_") or step.startswith("ip_") or \
             step.startswith("stock_") or step.startswith("asset_") or step.startswith("factoring_") or \
             step.startswith("trade_") or step.startswith("export_") or step.startswith("property_"):
            # Find the question in funding_type_questions
            funding_questions = collected_data.get("funding_type_questions", [])
            current_index_funding = collected_data.get("current_funding_question_index", 0)
            
            # Store the answer
            for q in funding_questions:
                if q["step"] == step:
                    field = q.get("field")
                    if field:
                        if q["type"] == "number":
                            try:
                                collected_data[field] = float(message.replace(",", "").replace("£", ""))
                            except:
                                pass
                        else:
                            collected_data[field] = message
                    break
            
            # Move to next funding question or proceed
            current_index_funding += 1
            collected_data["current_funding_question_index"] = current_index_funding
            
            if current_index_funding < len(funding_questions):
                # More questions to ask
                return funding_questions[current_index_funding]["step"]
            else:
                # All funding questions answered, proceed to documents
                return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        # FCA and Financial Information (Lenders)
        elif step == "fca_registration":
            collected_data["has_fca_registration"] = message_lower in ["yes", "y"]
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "fca_registration_number":
            if message_lower not in ["skip", "none", "n/a"]:
                collected_data["fca_registration_number"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "fca_permissions":
            if message_lower not in ["skip", "none", "n/a"]:
                collected_data["fca_permissions"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "financial_licences":
            if message_lower not in ["skip", "none", "n/a"]:
                collected_data["financial_licences"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "financial_capital_requirements":
            try:
                collected_data["regulatory_capital"] = float(message.replace(",", "").replace("£", ""))
            except:
                pass
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "financial_lending_capacity":
            try:
                collected_data["lending_capacity"] = float(message.replace(",", "").replace("£", ""))
            except:
                pass
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "key_personnel":
            if message_lower not in ["skip", "none", "n/a"]:
                collected_data["key_personnel"] = message
            return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
        
        elif step == "documents_collection":
            # Check if documents were uploaded
            # This step is handled by file upload, but we need to verify documents are uploaded
            # For now, if user sends a message, check document status
            if message_lower in ["done", "finished", "complete", "all uploaded", "uploaded"]:
                # Check if all required documents are uploaded
                doc_status = self.chatbot_service.check_uploaded_documents(collected_data, user_role)
                if doc_status["all_uploaded"]:
                    return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
                else:
                    # Still missing documents, stay on this step
                    return "documents_collection"
            else:
                # User might be trying to skip or provide text response
                # Check document status
                doc_status = self.chatbot_service.check_uploaded_documents(collected_data, user_role)
                if doc_status["all_uploaded"]:
                    # All documents uploaded, can proceed
                    return steps[current_index + 1] if current_index < len(steps) - 1 else "complete"
                else:
                    # Missing documents, remind and stay on this step
                    return "documents_collection"
        
        # Default: move to next step
        if current_index < len(steps) - 1:
            return steps[current_index + 1]
        return "complete"
    
    def _update_progress(self, progress: OnboardingProgress, collected_data: dict, user_role: str, user=None):
        """Update onboarding progress based on collected data."""
        if not collected_data:
            return
        
        try:
            # Check what's been collected
            if collected_data.get("first_name") and collected_data.get("last_name"):
                progress.profile_complete = True
            
            if collected_data.get("phone_number"):
                progress.contact_complete = True
            
            if collected_data.get("postcode") and collected_data.get("address_verification_data", {}).get("verified"):
                progress.address_complete = True
                progress.address_verified = True
            
            if collected_data.get("company_registration_number") and collected_data.get("company_verification_data", {}).get("verified"):
                progress.company_complete = True
                progress.company_verified = True
            
            if collected_data.get("annual_income"):
                progress.financial_complete = True
            
            # Calculate overall progress with user role
            progress.calculate_progress(user_role=user_role.lower() if user_role else None)
            
            # Auto-create ConsultantProfile if onboarding is complete and user is a Consultant
            if progress.is_complete and user:
                user_roles = UserRole.objects.filter(user=user).select_related("role")
                if user_roles.exists():
                    role_names = [ur.role.name for ur in user_roles]
                    if "Consultant" in role_names and not hasattr(user, "consultantprofile"):
                        self._create_consultant_profile(user, collected_data)
        except Exception as e:
            import traceback
            print(f"Error in _update_progress: {e}")
            print(traceback.format_exc())
            # Don't raise - just log the error
    
    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def upload_documents(self, request):
        """Upload documents for onboarding."""
        from documents.models import Document
        
        user = request.user
        files = request.FILES.getlist('files')
        
        if not files:
            return Response(
                {"error": "No files provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get or create onboarding data
        onboarding_data, _ = OnboardingData.objects.get_or_create(user=user)
        
        uploaded_documents = []
        for file in files:
            # Create document record
            document = Document.objects.create(
                owner=user,
                file_name=file.name,
                file_size=file.size,
                file_type=file.content_type or "application/octet-stream",
                upload_path=f"onboarding/{user.id}/{file.name}",
                description=f"Onboarding document: {file.name}",
            )
            
            # Link to onboarding data
            onboarding_data.documents_uploaded.add(document)
            uploaded_documents.append({
                "id": document.id,
                "file_name": document.file_name,
                "file_type": document.file_type,
            })
        
        onboarding_data.save()
        
        # Update session collected_data
        session = OnboardingSession.objects.filter(user=user, is_active=True).first()
        if session:
            collected_data = session.collected_data or {}
            if "documents_uploaded" not in collected_data:
                collected_data["documents_uploaded"] = []
            collected_data["documents_uploaded"].extend(uploaded_documents)
            session.collected_data = collected_data
            session.save()
        
        # Check document status
        doc_status = self.chatbot_service.check_uploaded_documents(
            collected_data if session else {},
            "Borrower"  # Default to Borrower for now
        )
        
        return Response({
            "message": f"Successfully uploaded {len(uploaded_documents)} document(s)",
            "documents": uploaded_documents,
            "document_status": doc_status,
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=["post"])
    def save_data(self, request):
        """Save collected onboarding data to OnboardingData model."""
        user = request.user
        data = request.data
        
        onboarding_data, _ = OnboardingData.objects.get_or_create(user=user)
        
        # Update fields from collected data
        for field in [
            "first_name", "last_name", "date_of_birth", "nationality",
            "phone_number", "mobile_number",
            "address_line_1", "address_line_2", "postcode", "town", "county", "country",
            "company_name", "company_registration_number", "company_type",
            "annual_income", "employment_status", "monthly_expenses",
            "assets_real_estate", "assets_investments", "assets_other",
            "liabilities_mortgages", "liabilities_loans", "liabilities_other",
            "experience_years", "previous_projects", "portfolio_description", "portfolio_property_details",
        ]:
            if field in data:
                setattr(onboarding_data, field, data[field])
        
        # Save verification data
        if "address_verification_data" in data:
            onboarding_data.address_verification_data = data["address_verification_data"]
            if data["address_verification_data"].get("verified"):
                onboarding_data.address_verified_at = timezone.now()
        
        if "company_verification_data" in data:
            onboarding_data.company_verification_data = data["company_verification_data"]
            if data["company_verification_data"].get("verified"):
                onboarding_data.company_verified_at = timezone.now()
        
        onboarding_data.save()
        
        return Response({"message": "Data saved successfully"})
    
    @action(detail=False, methods=["post"])
    def verify_address(self, request):
        """Verify address using Google API."""
        address_line_1 = request.data.get("address_line_1")
        postcode = request.data.get("postcode")
        town = request.data.get("town", "")
        
        if not address_line_1 or not postcode:
            return Response(
                {"error": "address_line_1 and postcode are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not self.address_service:
            # If address service is not available, skip verification
            collected_data["address_verification_data"] = {
                "verified": False,
                "message": "Address verification service not available"
            }
            verification = collected_data["address_verification_data"]
        else:
            verification = self.address_service.verify_address(address_line_1, postcode, town)
        return Response(verification)
    
    @action(detail=False, methods=["post"])
    def verify_company(self, request):
        """Verify company using HMRC API."""
        company_number = request.data.get("company_number")
        company_name = request.data.get("company_name", "")
        
        if not company_number:
            return Response(
                {"error": "company_number is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        verification = self.hmrc_service.verify_company(company_number, company_name)
        return Response(verification)
    
    def _create_consultant_profile(self, user, collected_data: dict):
        """Auto-create ConsultantProfile after onboarding completion for Consultants."""
        try:
            # Extract consultant-specific data from onboarding
            ConsultantProfile.objects.get_or_create(
                user=user,
                defaults={
                    'organisation_name': collected_data.get('company_name', '') or collected_data.get('organisation_name', '') or f"{collected_data.get('first_name', '')} {collected_data.get('last_name', '')}".strip() or 'Consultant',
                    'trading_name': collected_data.get('trading_name', ''),
                    'company_registration_number': collected_data.get('company_registration_number', ''),
                    'primary_service': collected_data.get('consultant_type', 'other'),
                    'services_offered': collected_data.get('services_offered', []),
                    'qualifications': collected_data.get('qualifications', []),
                    'contact_email': collected_data.get('email', user.email),
                    'contact_phone': collected_data.get('phone_number', '') or collected_data.get('mobile_number', ''),
                    'address_line_1': collected_data.get('address_line_1', ''),
                    'city': collected_data.get('city', ''),
                    'county': collected_data.get('county', ''),
                    'postcode': collected_data.get('postcode', ''),
                    'country': collected_data.get('country', 'United Kingdom'),
                    'geographic_coverage': collected_data.get('geographic_coverage', []),
                    'years_of_experience': collected_data.get('years_of_experience'),
                    'team_size': collected_data.get('team_size'),
                    'max_capacity': collected_data.get('max_capacity', 10),
                    'current_capacity': 0,
                    'average_response_time_days': collected_data.get('average_response_time_days', 5),
                    'is_active': True,
                    'is_verified': False,  # Will need admin verification
                }
            )
        except Exception as e:
            import traceback
            print(f"Error creating ConsultantProfile: {e}")
            print(traceback.format_exc())
            # Don't raise - just log the error
