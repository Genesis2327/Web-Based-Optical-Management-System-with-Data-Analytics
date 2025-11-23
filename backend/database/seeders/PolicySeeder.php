<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Policy;
use App\Models\User;
use Carbon\Carbon;

class PolicySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Check if policies already exist
        $existingPrivacy = Policy::where('type', 'privacy_policy')->where('is_active', true)->first();
        $existingTerms = Policy::where('type', 'terms_conditions')->where('is_active', true)->first();

        if ($existingPrivacy || $existingTerms) {
            $this->command->warn('Active policies already exist. Skipping seeder.');
            $this->command->info('To create new versions, use the admin panel or API.');
            return;
        }

        // Get the first admin user or create a system user
        $admin = User::where('role', 'admin')->first();
        $createdBy = $admin ? $admin->id : null;

        // Privacy Policy
        $privacyPolicy = Policy::create([
            'type' => 'privacy_policy',
            'version' => '1.0',
            'title' => 'Privacy Policy',
            'content' => $this->getPrivacyPolicyContent(),
            'is_active' => true,
            'effective_date' => Carbon::now(),
            'created_by' => $createdBy,
        ]);

        // Terms and Conditions
        $termsConditions = Policy::create([
            'type' => 'terms_conditions',
            'version' => '1.0',
            'title' => 'Terms and Conditions',
            'content' => $this->getTermsConditionsContent(),
            'is_active' => true,
            'effective_date' => Carbon::now(),
            'created_by' => $createdBy,
        ]);

        $this->command->info('✅ Privacy Policy (v1.0) created successfully!');
        $this->command->info('✅ Terms and Conditions (v1.0) created successfully!');
        $this->command->newLine();
        $this->command->info('Policies are now active and will be displayed during registration.');
    }

    private function getPrivacyPolicyContent(): string
    {
        $content = "PRIVACY POLICY\n\n";
        $content .= "Everbright Optical Clinic Management System\n\n";
        $content .= "Last Updated: January 2025\n\n";
        $content .= "1. INTRODUCTION\n\n";
        $content .= "Everbright Optical Clinic (\"we,\" \"our,\" or \"us\") is committed to protecting your privacy. ";
        $content .= "This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web-based optical clinic management system (the \"System\"). ";
        $content .= "Please read this Privacy Policy carefully.\n\n";
        $content .= "By using our System, you consent to the data practices described in this policy.\n\n";
        
        $content .= "2. INFORMATION WE COLLECT\n\n";
        $content .= "2.1 Personal Information\n";
        $content .= "We collect personal information that you provide directly to us, including:\n";
        $content .= "- Name and contact information (email address, phone number, address)\n";
        $content .= "- Date of birth and gender\n";
        $content .= "- Medical history and eye health records\n";
        $content .= "- Prescription information (eye measurements, vision data)\n";
        $content .= "- Appointment history and scheduling information\n";
        $content .= "- Payment and transaction information\n";
        $content .= "- Emergency contact information\n\n";
        
        $content .= "2.2 Automatically Collected Information\n";
        $content .= "When you use our System, we may automatically collect:\n";
        $content .= "- Device information (IP address, browser type, operating system)\n";
        $content .= "- Usage data (pages visited, time spent, features used)\n";
        $content .= "- Log files and system activity\n\n";
        
        $content .= "3. HOW WE USE YOUR INFORMATION\n\n";
        $content .= "We use the information we collect for the following purposes:\n";
        $content .= "- To provide and maintain our services\n";
        $content .= "- To process appointments and manage your eye care records\n";
        $content .= "- To communicate with you about appointments, prescriptions, and services\n";
        $content .= "- To send notifications about product availability and follow-up schedules\n";
        $content .= "- To track product usage and provide personalized care reminders\n";
        $content .= "- To process transactions and generate receipts\n";
        $content .= "- To improve our services and user experience\n";
        $content .= "- To comply with legal obligations\n";
        $content .= "- To protect the rights and safety of our users\n\n";
        
        $content .= "4. DATA SHARING AND DISCLOSURE\n\n";
        $content .= "We do not sell your personal information. We may share your information only in the following circumstances:\n";
        $content .= "- With healthcare professionals (optometrists, staff) within our clinic network for providing services\n";
        $content .= "- With service providers who assist in operating our System (under strict confidentiality agreements)\n";
        $content .= "- When required by law or to comply with legal processes\n";
        $content .= "- To protect our rights, privacy, safety, or property\n";
        $content .= "- In connection with a business transfer (merger, acquisition, etc.)\n\n";
        
        $content .= "5. DATA SECURITY\n\n";
        $content .= "We implement appropriate technical and organizational security measures to protect your personal information, including:\n";
        $content .= "- Encryption of sensitive data in transit and at rest\n";
        $content .= "- Access controls and authentication mechanisms\n";
        $content .= "- Regular security audits and updates\n";
        $content .= "- Secure data storage and backup procedures\n";
        $content .= "- Staff training on data protection\n\n";
        $content .= "However, no method of transmission over the Internet or electronic storage is 100% secure. ";
        $content .= "While we strive to protect your information, we cannot guarantee absolute security.\n\n";
        
        $content .= "6. DATA RETENTION\n\n";
        $content .= "We retain your personal information for as long as necessary to:\n";
        $content .= "- Provide our services to you\n";
        $content .= "- Comply with legal obligations\n";
        $content .= "- Resolve disputes and enforce agreements\n";
        $content .= "- Maintain medical records as required by law\n\n";
        $content .= "Medical records and prescription data may be retained for extended periods as required by healthcare regulations.\n\n";
        
        $content .= "7. YOUR RIGHTS\n\n";
        $content .= "You have the right to:\n";
        $content .= "- Access your personal information\n";
        $content .= "- Request correction of inaccurate information\n";
        $content .= "- Request deletion of your information (subject to legal requirements)\n";
        $content .= "- Object to processing of your information\n";
        $content .= "- Request data portability\n";
        $content .= "- Withdraw consent (where applicable)\n\n";
        $content .= "To exercise these rights, please contact us using the contact information provided below.\n\n";
        
        $content .= "8. COOKIES AND TRACKING\n\n";
        $content .= "Our System may use cookies and similar tracking technologies to enhance your experience. ";
        $content .= "You can control cookie preferences through your browser settings.\n\n";
        
        $content .= "9. CHILDREN'S PRIVACY\n\n";
        $content .= "Our System is not intended for children under 18 years of age. ";
        $content .= "We do not knowingly collect personal information from children. ";
        $content .= "If you believe we have collected information from a child, please contact us immediately.\n\n";
        
        $content .= "10. CHANGES TO THIS PRIVACY POLICY\n\n";
        $content .= "We may update this Privacy Policy from time to time. We will notify you of any material changes by:\n";
        $content .= "- Posting the new Privacy Policy on this page\n";
        $content .= "- Updating the \"Last Updated\" date\n";
        $content .= "- Notifying you through the System or via email\n\n";
        $content .= "Your continued use of the System after changes become effective constitutes acceptance of the updated policy.\n\n";
        
        $content .= "11. CONTACT US\n\n";
        $content .= "If you have questions or concerns about this Privacy Policy or our data practices, please contact us:\n\n";
        $content .= "Everbright Optical Clinic\n";
        $content .= "Email: privacy@everbrightoptical.com\n";
        $content .= "Phone: [Contact Number]\n\n";
        
        $content .= "12. CONSENT\n\n";
        $content .= "By using our System, you acknowledge that you have read and understood this Privacy Policy ";
        $content .= "and agree to the collection, use, and disclosure of your information as described herein.\n";
        
        return $content;
    }

    private function getTermsConditionsContent(): string
    {
        $content = "TERMS AND CONDITIONS\n\n";
        $content .= "Everbright Optical Clinic Management System\n\n";
        $content .= "Last Updated: January 2025\n\n";
        
        $content .= "1. ACCEPTANCE OF TERMS\n\n";
        $content .= "By accessing and using the Everbright Optical Clinic Management System (the \"System\"), ";
        $content .= "you accept and agree to be bound by these Terms and Conditions. ";
        $content .= "If you do not agree to these terms, please do not use the System.\n\n";
        
        $content .= "2. DESCRIPTION OF SERVICE\n\n";
        $content .= "The System is a web-based platform that provides:\n";
        $content .= "- Patient record management\n";
        $content .= "- Appointment scheduling and management\n";
        $content .= "- Prescription tracking and management\n";
        $content .= "- Inventory management\n";
        $content .= "- Point of sale (POS) transactions\n";
        $content .= "- Product reservations\n";
        $content .= "- Data analytics and reporting\n";
        $content .= "- Customer notifications and reminders\n\n";
        
        $content .= "3. USER ACCOUNTS\n\n";
        $content .= "3.1 Account Creation\n";
        $content .= "- You must provide accurate, current, and complete information during registration\n";
        $content .= "- You are responsible for maintaining the confidentiality of your account credentials\n";
        $content .= "- You must notify us immediately of any unauthorized use of your account\n";
        $content .= "- You are responsible for all activities that occur under your account\n\n";
        
        $content .= "3.2 Account Types\n";
        $content .= "- Customer: Access to personal records, appointments, and product browsing\n";
        $content .= "- Staff: Access to branch-specific operations and inventory management\n";
        $content .= "- Optometrist: Access to patient records, prescriptions, and appointment management\n";
        $content .= "- Admin: Full system access and administrative functions\n\n";
        
        $content .= "4. ACCEPTABLE USE\n\n";
        $content .= "You agree not to:\n";
        $content .= "- Use the System for any unlawful purpose\n";
        $content .= "- Attempt to gain unauthorized access to the System or other users' accounts\n";
        $content .= "- Interfere with or disrupt the System's operation\n";
        $content .= "- Transmit viruses, malware, or harmful code\n";
        $content .= "- Use automated systems to access the System without permission\n";
        $content .= "- Copy, modify, or distribute System content without authorization\n";
        $content .= "- Reverse engineer or attempt to extract source code\n\n";
        
        $content .= "5. MEDICAL INFORMATION AND PRESCRIPTIONS\n\n";
        $content .= "5.1 Medical Records\n";
        $content .= "- All medical information stored in the System is confidential\n";
        $content .= "- Prescriptions and eye health records are maintained for clinical purposes\n";
        $content .= "- You acknowledge that the System is a tool to assist healthcare providers and does not replace professional medical judgment\n\n";
        
        $content .= "5.2 Prescription Validity\n";
        $content .= "- Prescriptions are valid only when issued by licensed optometrists\n";
        $content .= "- Prescription expiry dates must be observed\n";
        $content .= "- The System tracks prescription validity but does not guarantee prescription accuracy\n\n";
        
        $content .= "6. APPOINTMENTS AND SERVICES\n\n";
        $content .= "6.1 Appointment Booking\n";
        $content .= "- Appointments are subject to availability\n";
        $content .= "- You must provide accurate information when booking\n";
        $content .= "- Cancellation policies apply as communicated by the clinic\n";
        $content .= "- The clinic reserves the right to reschedule or cancel appointments\n\n";
        
        $content .= "6.2 Service Provision\n";
        $content .= "- Services are provided by licensed healthcare professionals\n";
        $content .= "- The System facilitates service management but does not guarantee service outcomes\n";
        $content .= "- All services are subject to clinic policies and procedures\n\n";
        
        $content .= "7. PRODUCT RESERVATIONS AND PURCHASES\n\n";
        $content .= "7.1 Product Reservations\n";
        $content .= "- Product reservations are subject to availability\n";
        $content .= "- Reservations may be approved or rejected by clinic staff\n";
        $content .= "- Reserved products are held for a limited time\n";
        $content .= "- The clinic reserves the right to cancel reservations\n\n";
        
        $content .= "7.2 Purchases and Payments\n";
        $content .= "- All prices are displayed in the System\n";
        $content .= "- Payment must be made according to clinic policies\n";
        $content .= "- Receipts are generated for all transactions\n";
        $content .= "- Returns and refunds are subject to clinic policies\n\n";
        
        $content .= "8. INTELLECTUAL PROPERTY\n\n";
        $content .= "- The System and all its content are owned by Everbright Optical Clinic\n";
        $content .= "- You may not copy, modify, or distribute System content\n";
        $content .= "- All trademarks and logos are the property of their respective owners\n\n";
        
        $content .= "9. DATA AND PRIVACY\n\n";
        $content .= "- Your use of the System is also governed by our Privacy Policy\n";
        $content .= "- We collect and process personal information as described in the Privacy Policy\n";
        $content .= "- You consent to the collection and use of your information as described\n\n";
        
        $content .= "10. SYSTEM AVAILABILITY\n\n";
        $content .= "- We strive to maintain System availability but do not guarantee uninterrupted access\n";
        $content .= "- The System may be unavailable due to maintenance, updates, or technical issues\n";
        $content .= "- We are not liable for any loss resulting from System unavailability\n\n";
        
        $content .= "11. LIMITATION OF LIABILITY\n\n";
        $content .= "To the maximum extent permitted by law:\n";
        $content .= "- The System is provided \"as is\" without warranties of any kind\n";
        $content .= "- We are not liable for any indirect, incidental, or consequential damages\n";
        $content .= "- Our total liability is limited to the amount you paid for services (if any)\n";
        $content .= "- We are not responsible for third-party services or content\n\n";
        
        $content .= "12. INDEMNIFICATION\n\n";
        $content .= "You agree to indemnify and hold harmless Everbright Optical Clinic, its employees, and agents from any claims, damages, or expenses arising from:\n";
        $content .= "- Your use of the System\n";
        $content .= "- Your violation of these Terms\n";
        $content .= "- Your violation of any rights of another party\n\n";
        
        $content .= "13. TERMINATION\n\n";
        $content .= "We may terminate or suspend your account and access to the System at our sole discretion, without notice, for:\n";
        $content .= "- Violation of these Terms\n";
        $content .= "- Fraudulent or illegal activity\n";
        $content .= "- Non-payment of fees (if applicable)\n";
        $content .= "- Any other reason we deem necessary\n\n";
        
        $content .= "14. CHANGES TO TERMS\n\n";
        $content .= "We reserve the right to modify these Terms at any time. We will notify you of material changes by:\n";
        $content .= "- Posting updated Terms on the System\n";
        $content .= "- Updating the \"Last Updated\" date\n";
        $content .= "- Notifying you through the System or via email\n\n";
        $content .= "Your continued use of the System after changes constitutes acceptance of the updated Terms.\n\n";
        
        $content .= "15. GOVERNING LAW\n\n";
        $content .= "These Terms are governed by the laws of [Your Jurisdiction]. ";
        $content .= "Any disputes will be resolved in the courts of [Your Jurisdiction].\n\n";
        
        $content .= "16. SEVERABILITY\n\n";
        $content .= "If any provision of these Terms is found to be unenforceable, ";
        $content .= "the remaining provisions will remain in full effect.\n\n";
        
        $content .= "17. ENTIRE AGREEMENT\n\n";
        $content .= "These Terms, together with the Privacy Policy, constitute the entire agreement ";
        $content .= "between you and Everbright Optical Clinic regarding the System.\n\n";
        
        $content .= "18. CONTACT INFORMATION\n\n";
        $content .= "For questions about these Terms, please contact:\n\n";
        $content .= "Everbright Optical Clinic\n";
        $content .= "Email: support@everbrightoptical.com\n";
        $content .= "Phone: [Contact Number]\n\n";
        
        $content .= "19. ACKNOWLEDGMENT\n\n";
        $content .= "By using the System, you acknowledge that you have read, understood, ";
        $content .= "and agree to be bound by these Terms and Conditions.\n";
        
        return $content;
    }
}
