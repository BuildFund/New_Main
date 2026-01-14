"""Document encryption service for secure file storage."""
from __future__ import annotations

import os
from pathlib import Path
from cryptography.fernet import Fernet
from django.conf import settings


class DocumentEncryption:
    """Service for encrypting and decrypting documents."""
    
    def __init__(self):
        """Initialize encryption service with key from environment."""
        encryption_key = os.environ.get('DOCUMENT_ENCRYPTION_KEY')
        if not encryption_key:
            raise ValueError(
                "DOCUMENT_ENCRYPTION_KEY environment variable is required. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        self.cipher = Fernet(encryption_key.encode())
        self.storage_path = Path(settings.MEDIA_ROOT) / 'encrypted_documents'
        self.storage_path.mkdir(parents=True, exist_ok=True)
    
    def encrypt_file(self, file_path: str) -> tuple[str, str]:
        """
        Encrypt a file and store it securely.
        
        Args:
            file_path: Path to the file to encrypt
            
        Returns:
            Tuple of (encrypted_file_path, encryption_metadata)
        """
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Read file content
        with open(file_path_obj, 'rb') as f:
            file_content = f.read()
        
        # Encrypt content
        encrypted_content = self.cipher.encrypt(file_content)
        
        # Generate secure filename
        import hashlib
        file_hash = hashlib.sha256(file_content).hexdigest()
        encrypted_filename = f"{file_hash}.enc"
        encrypted_path = self.storage_path / encrypted_filename
        
        # Write encrypted file
        with open(encrypted_path, 'wb') as f:
            f.write(encrypted_content)
        
        # Return metadata (original filename, hash, etc.)
        metadata = {
            'original_filename': file_path_obj.name,
            'file_hash': file_hash,
            'encrypted_filename': encrypted_filename,
        }
        
        return str(encrypted_path), str(metadata)
    
    def decrypt_file(self, encrypted_path: str, output_path: str = None) -> bytes:
        """
        Decrypt a file.
        
        Args:
            encrypted_path: Path to encrypted file
            output_path: Optional path to save decrypted file (if None, returns bytes)
            
        Returns:
            Decrypted file content as bytes
        """
        encrypted_path_obj = Path(encrypted_path)
        if not encrypted_path_obj.exists():
            raise FileNotFoundError(f"Encrypted file not found: {encrypted_path}")
        
        # Read encrypted content
        with open(encrypted_path_obj, 'rb') as f:
            encrypted_content = f.read()
        
        # Decrypt content
        try:
            decrypted_content = self.cipher.decrypt(encrypted_content)
        except Exception as e:
            raise ValueError(f"Failed to decrypt file: {str(e)}")
        
        # Save to output path if provided
        if output_path:
            output_path_obj = Path(output_path)
            output_path_obj.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path_obj, 'wb') as f:
                f.write(decrypted_content)
        
        return decrypted_content
    
    def encrypt_bytes(self, data: bytes) -> bytes:
        """Encrypt bytes data."""
        return self.cipher.encrypt(data)
    
    def decrypt_bytes(self, encrypted_data: bytes) -> bytes:
        """Decrypt bytes data."""
        return self.cipher.decrypt(encrypted_data)
