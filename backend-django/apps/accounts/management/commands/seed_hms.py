"""Seed the database with demo data for all HMS modules."""
import random
from datetime import date, time, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.models import User, PatientProfile
from apps.doctors.models import Specialty, DoctorProfile
from apps.appointments.models import Appointment, Prescription, PrescriptionItem
from apps.pharmacy.models import Drug, StockMovement
from apps.billing.models import Invoice, InvoiceItem
from apps.queue_mgmt.models import QueueToken


class Command(BaseCommand):
    help = "Seed HMS with demo data"

    def handle(self, *args, **options):
        self.stdout.write("[HMS] Seeding database...")

        # --- Specialties ---
        specialties_data = [
            ("Cardiology", "أمراض القلب", "❤️"),
            ("Dermatology", "الأمراض الجلدية", "🧴"),
            ("Orthopedics", "جراحة العظام", "🦴"),
            ("Neurology", "طب الأعصاب", "🧠"),
            ("Pediatrics", "طب الأطفال", "👶"),
            ("Ophthalmology", "طب العيون", "👁️"),
            ("General Medicine", "الطب العام", "🏥"),
        ]
        specialties = {}
        for name, name_ar, icon in specialties_data:
            sp, _ = Specialty.objects.get_or_create(name=name, defaults={"name_ar": name_ar, "icon": icon})
            specialties[name] = sp
        self.stdout.write(f"  [OK] {len(specialties)} specialties created")

        # --- Admin ---
        admin_user, _ = User.objects.get_or_create(
            email="admin@hms.ae",
            defaults={"username": "admin_hms", "first_name": "HMS", "last_name": "Admin",
                      "role": User.Role.ADMIN, "is_staff": True, "is_superuser": True}
        )
        admin_user.set_password("Admin@1234")
        admin_user.save()

        # --- Doctors ---
        doctors_data = [
            ("sara.khan@hms.ae", "Sara", "Khan", "Cardiology", "LIC-001"),
            ("ahmed.ali@hms.ae", "Ahmed", "Ali", "Dermatology", "LIC-002"),
            ("lina.noor@hms.ae", "Lina", "Noor", "Orthopedics", "LIC-003"),
            ("omar.aziz@hms.ae", "Omar", "Aziz", "Neurology", "LIC-004"),
            ("fatima.malik@hms.ae", "Fatima", "Malik", "Pediatrics", "LIC-005"),
        ]
        doctor_profiles = []
        for email, first, last, spec_name, lic in doctors_data:
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={"username": email.split("@")[0], "first_name": first, "last_name": last,
                          "role": User.Role.DOCTOR}
            )
            user.set_password("Doctor@1234")
            user.save()
            profile, _ = DoctorProfile.objects.get_or_create(
                user=user,
                defaults={
                    "specialty": specialties[spec_name],
                    "license_number": lic,
                    "bio": f"Experienced {spec_name} specialist with 10+ years of practice.",
                    "consultation_fee_aed": random.choice([200, 250, 300]),
                    "consultation_fee_sar": random.choice([200, 250, 300]),
                    "consultation_fee_eur": random.choice([60, 80, 100]),
                    "is_tele_health_enabled": True,
                }
            )
            doctor_profiles.append(profile)
        self.stdout.write(f"  [OK] {len(doctor_profiles)} doctors created")

        # --- Pharmacist ---
        pharma_user, _ = User.objects.get_or_create(
            email="pharma@hms.ae",
            defaults={"username": "pharma_hms", "first_name": "Pharmacy", "last_name": "Staff",
                      "role": User.Role.PHARMACIST}
        )
        pharma_user.set_password("Pharma@1234")
        pharma_user.save()

        # --- Patient ---
        patient_user, _ = User.objects.get_or_create(
            email="patient@hms.ae",
            defaults={"username": "patient_demo", "first_name": "Demo", "last_name": "Patient",
                      "role": User.Role.PATIENT}
        )
        patient_user.set_password("Patient@1234")
        patient_user.save()
        PatientProfile.objects.get_or_create(
            user=patient_user,
            defaults={"consent_version": "v1", "consent_given_at": timezone.now()}
        )
        self.stdout.write("  [OK] Patient + Pharmacist + Admin created")

        # --- Drugs ---
        drugs_data = [
            ("Paracetamol 500mg", "باراسيتامول", "PCT-500", "Analgesic", 34, 10, 2.5, "2027-06"),
            ("Amoxicillin 250mg", "أموكسيسيلين", "AMX-250", "Antibiotic", 7, 15, 5.0, "2026-08"),
            ("Vitamin D3 1000IU", "فيتامين د3", "VIT-D3", "Supplement", 21, 10, 8.0, "2027-11"),
            ("Metformin 500mg", "ميتفورمين", "MET-500", "Antidiabetic", 45, 20, 3.5, "2027-03"),
            ("Omeprazole 20mg", "أوميبرازول", "OMP-20", "Antacid", 3, 10, 6.0, "2026-12"),
            ("Atorvastatin 10mg", "أتورفاستاتين", "ATO-10", "Cardiovascular", 18, 10, 12.0, "2027-09"),
            ("Salbutamol Inhaler", "سالبيوتامول", "SAL-INH", "Respiratory", 12, 5, 45.0, "2027-01"),
        ]
        for name, name_ar, sku, cat, stock, threshold, price, expiry_str in drugs_data:
            Drug.objects.get_or_create(
                sku=sku,
                defaults={
                    "name": name, "name_ar": name_ar, "category": cat,
                    "stock_quantity": stock, "low_stock_threshold": threshold,
                    "unit_price_aed": price,
                    "expiry_date": date.fromisoformat(f"{expiry_str}-01"),
                }
            )
        self.stdout.write(f"  [OK] {len(drugs_data)} drugs seeded")

        # --- Appointments ---
        today = timezone.now().date()
        times = [time(9, 0), time(10, 0), time(11, 0), time(14, 0), time(15, 0)]
        created_appts = 0
        for i, apt_time in enumerate(times):
            doctor = doctor_profiles[i % len(doctor_profiles)]
            currency = "AED"
            fee = doctor.consultation_fee_aed
            apt, created = Appointment.objects.get_or_create(
                doctor=doctor,
                appointment_date=today,
                appointment_time=apt_time,
                defaults={
                    "patient": patient_user,
                    "fee": fee,
                    "currency": currency,
                    "status": Appointment.Status.SCHEDULED if i < 3 else Appointment.Status.COMPLETED,
                    "chief_complaint": "Routine checkup",
                }
            )
            if created:
                created_appts += 1
            # Add prescription to completed
            if apt.status == Appointment.Status.COMPLETED and not hasattr(apt, "prescription"):
                rx = Prescription.objects.create(appointment=apt, notes="Follow up in 2 weeks")
                PrescriptionItem.objects.create(
                    prescription=rx, drug_name="Paracetamol 500mg",
                    dosage="500mg", frequency="Twice daily", duration_days=7, quantity=14
                )
        self.stdout.write(f"  [OK] {created_appts} appointments seeded")

        # --- Queue Tokens ---
        for i in range(1, 6):
            QueueToken.objects.get_or_create(
                queue_date=today,
                token_number=i,
                defaults={
                    "patient": patient_user if i == 1 else None,
                    "patient_name": f"Walk-in #{i}" if i > 1 else "",
                    "status": QueueToken.Status.COMPLETED if i < 3 else QueueToken.Status.WAITING,
                    "is_priority": (i == 1),
                }
            )
        self.stdout.write("  [OK] Queue tokens seeded")

        # --- Invoices ---
        inv, created = Invoice.objects.get_or_create(
            invoice_number="INV-DEMO001",
            defaults={
                "patient": patient_user, "status": Invoice.Status.PAID,
                "currency": "AED", "subtotal": 220,
                "payment_method": Invoice.PaymentMethod.CARD,
                "amount_paid": 231, "paid_at": timezone.now(),
            }
        )
        if created:
            InvoiceItem.objects.create(
                invoice=inv, item_type="CONSULTATION",
                description="Cardiology Consultation", quantity=1, unit_price=200, total_price=200
            )
            InvoiceItem.objects.create(
                invoice=inv, item_type="MEDICINE",
                description="Paracetamol 500mg x14", quantity=14, unit_price=2.5, total_price=35
            )
            inv.save()

        self.stdout.write("\n[DONE] HMS seeding complete!\n")
        self.stdout.write("Demo credentials:")
        self.stdout.write("  Admin:      admin@hms.ae / Admin@1234")
        self.stdout.write("  Doctor:     sara.khan@hms.ae / Doctor@1234")
        self.stdout.write("  Pharmacist: pharma@hms.ae / Pharma@1234")
        self.stdout.write("  Patient:    patient@hms.ae / Patient@1234")
