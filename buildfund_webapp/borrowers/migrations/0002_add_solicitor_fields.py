# Generated manually to add solicitor fields that were missing from database

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('borrowers', '0001_initial'),
        migrations.swappable_dependency('auth.user'),
    ]

    operations = [
        migrations.AddField(
            model_name='borrowerprofile',
            name='solicitor_firm_name',
            field=models.CharField(blank=True, help_text="Borrower's preferred solicitor firm name", max_length=255),
        ),
        migrations.AddField(
            model_name='borrowerprofile',
            name='solicitor_sra_number',
            field=models.CharField(blank=True, help_text='SRA registration number', max_length=50),
        ),
        migrations.AddField(
            model_name='borrowerprofile',
            name='solicitor_contact_name',
            field=models.CharField(blank=True, help_text='Primary contact at solicitor firm', max_length=255),
        ),
        migrations.AddField(
            model_name='borrowerprofile',
            name='solicitor_contact_email',
            field=models.EmailField(blank=True, help_text='Solicitor contact email', max_length=254),
        ),
        migrations.AddField(
            model_name='borrowerprofile',
            name='solicitor_contact_phone',
            field=models.CharField(blank=True, help_text='Solicitor contact phone', max_length=30),
        ),
    ]
