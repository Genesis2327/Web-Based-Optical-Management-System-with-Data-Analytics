Web-Based Optical Management System with Data Analytics

A Web-Based Optical Management System with Data Analytics developed for Everbright Optical Clinic as a Bachelor of Science in Information Technology capstone project.

The system is designed to centralize and automate essential optical clinic operations, including patient records, appointments, prescriptions, inventory management, point-of-sale transactions, multi-branch management, and descriptive data analytics.

Academic Capstone Project — Bachelor of Science in Information Technology
University of Cabuyao (Pamantasan ng Cabuyao)
College of Computing Studies
December 2025

📌 Overview

Everbright Optical Clinic previously relied on manual and fragmented processes for managing patient records, appointments, inventory, sales, and operational information.

This project provides a centralized web-based platform that helps streamline these processes while providing analytics dashboards for monitoring clinic performance and historical trends.

The system is designed to support the clinic's four branches and provide access through desktop and mobile web browsers.

✨ Key Features
👤 Patient Management
Patient registration and login
Patient profile management
Patient demographic records
Vision history tracking
Prescription history
Digital prescription viewing
Appointment history
Patient feedback and ratings
📅 Appointment Management
Online appointment booking
Appointment scheduling
Appointment history
Appointment reminders
Optometrist appointment management
Branch-based appointment handling
👓 Digital Prescription
Digital prescription generation
Recording of right-eye and left-eye prescription information
Prescription history
Prescription status and expiration tracking
Electronic prescription access for patients
📦 Inventory Management
Optical product management
Real-time stock monitoring
Frames, lenses, sunglasses, and eye-care products
Low-stock notifications
Reorder-level monitoring
ABC Analysis for inventory classification
Branch-based inventory management
🛒 Point of Sale (POS)
In-clinic product transactions
Product lookup
Automatic transaction totals
Sales recording
Digital receipt generation
Inventory deduction after sales
Sales and revenue reporting
📊 Data Analytics
Centralized analytics dashboard
Revenue monitoring
Appointment statistics
Patient demographics
Prescription trends
Sales performance
Branch performance comparison
Interactive charts and data visualization
PDF report generation
🏢 Multi-Branch Management
Support for four clinic branches
Branch selection and filtering
Branch-specific records
Branch performance comparison
Centralized access to clinic data
🔔 Customer Notification & Tracking
Product availability notifications
Follow-up reminders
Eye-grade change notifications
Lens replacement tracking
Patient interaction history
Customer feedback collection
📱 Responsive Design
Desktop browser support
Mobile browser support
Responsive dashboards
Responsive product galleries
Mobile-friendly interface

The documented system includes centralized analytics, multi-branch management, patient records, inventory, POS, data visualization, multi-device compatibility, and customer tracking.

🛠️ Technology Stack
Frontend
React.js
JavaScript
HTML5
CSS3
Bootstrap
Tailwind CSS
React Query
Recharts
Backend
PHP
Laravel
REST API
Database
SQLite — Development
MySQL — Production-ready database
Development & Server
Visual Studio Code
Apache HTTP Server
Git / GitHub

The project documentation identifies React, Bootstrap, Tailwind CSS, Laravel, SQLite for development, and MySQL compatibility for production. Recharts and React Query are used for analytics and frontend data handling.

🏗️ System Architecture
┌──────────────────────────────────────────┐
│              CLIENT LAYER                │
│                                          │
│  Desktop Browser    Mobile Browser       │
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│             FRONTEND LAYER               │
│                                          │
│ React.js                                 │
│ Bootstrap / Tailwind CSS                 │
│ React Query                              │
│ Recharts                                 │
└─────────────────┬────────────────────────┘
                  │
                  │ REST API
                  ▼
┌──────────────────────────────────────────┐
│              BACKEND LAYER               │
│                                          │
│ Laravel / PHP                            │
│ Authentication                           │
│ Business Logic                           │
│ API Endpoints                            │
│ Role-Based Access Control                │
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│              DATABASE                    │
│                                          │
│ SQLite (Development)                     │
│ MySQL (Production)                       │
└──────────────────────────────────────────┘
👥 User Roles

The system implements role-based access control to restrict functionality according to the user's role.

Administrator
Manage users and roles
Manage branches
Monitor clinic-wide analytics
Manage inventory
Monitor sales
Access reports
Manage patient information
Manage system operations
Clinic Staff
Manage appointments
Manage patient records
Process POS transactions
Manage inventory
View reports
Assist with clinic operations
Optometrist
View patient records
Manage vision records
Conduct and record examinations
Create digital prescriptions
Monitor patient vision history
Access relevant clinical analytics
Patient
Register and log in
Manage profile
Book appointments
View appointment history
View vision history
View digital prescriptions
Receive notifications
Submit feedback and ratings

The documented workflows cover patient self-service, clinic personnel operations, optometrist functions, and administrative management.

🔐 Security

The system includes several mechanisms intended to protect sensitive clinic and patient information:

Role-Based Access Control (RBAC)
User authentication
Audit logs
Soft deletes
Restricted access to patient records
Data confidentiality measures

The project documentation specifically identifies audit logs, soft deletes, and RBAC as security and accountability mechanisms.

📈 Analytics

The system focuses on descriptive analytics, allowing clinic administrators and authorized personnel to understand historical operational data.

Analytics include:

Revenue trends
Sales performance
Appointment trends
Patient demographics
Prescription trends
Branch performance
Patient activity
Inventory-related information

The system is intentionally limited to descriptive analytics and does not provide predictive forecasting or automated recommendations.

🧪 Testing

Testing was conducted throughout the development process to verify functionality, integration, usability, and data consistency.

Testing activities included:

Unit testing
System testing
Usability testing
Functional testing
Database and integration testing
User feedback and evaluation

Testing included important workflows such as saving prescriptions, managing appointments, updating inventory, and checking integration between system modules.

🔄 Development Methodology

The project followed an Agile development methodology.

Development was divided into iterative phases:

Analysis & Requirements
          ↓
        Design
          ↓
Development & Implementation
          ↓
       Testing
          ↓
      Deployment
          ↓
     Maintenance

The Agile approach allowed the team to continuously test, evaluate, and refine the system based on stakeholder feedback.

🗄️ Main Database Entities

The system database includes entities for managing the major clinic operations:

Users
Patients
Branches
Appointments
Exams
Prescriptions
Inventory
Sales
SaleItems
Feedback
AnalyticsData

These entities support user management, patient records, appointments, examinations, prescriptions, inventory, sales, feedback, and analytics.

📂 Project Structure

A typical project structure is organized into separate frontend and backend applications:

EverBright-Optical-Clinic-System/
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── ...
│
├── backend/
│   ├── app/
│   ├── routes/
│   ├── database/
│   ├── resources/
│   └── ...
│
├── README.md
└── ...

The exact folder structure may vary depending on the current repository implementation.

⚙️ Installation
Prerequisites

Make sure the following are installed:

Git
Node.js
npm
PHP
Composer
MySQL or SQLite
Apache/XAMPP or another PHP-compatible server
Clone the Repository
git clone https://github.com/protacium05/EverBright-Optical-Clinic-System.git

cd EverBright-Optical-Clinic-System
Frontend
cd frontend

npm install

npm run dev
Backend
cd backend

composer install

Create the environment file:

cp .env.example .env

Generate the Laravel application key:

php artisan key:generate

Configure the database in .env, then run:

php artisan migrate

Start the Laravel development server:

php artisan serve

Update the commands above if the current repository uses a different folder structure or setup process.

🖥️ System Modules
                    EVERBRIGHT OPTICAL
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   Patient Care       Business Ops       Analytics
        │                  │                  │
   ┌────┴────┐       ┌─────┴─────┐      ┌────┴────┐
   │         │       │           │      │         │
Patients  Prescriptions  Inventory  POS  Reports  Dashboard
   │         │       │           │      │         │
   └────┬────┘       └─────┬─────┘      └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    Centralized Data
⚠️ Limitations

The current system has the following documented limitations:

Descriptive analytics only
Requires an internet connection
No third-party healthcare platform integration
No online payment processing
Basic inventory alerts
No automatic restocking
No expiry monitoring
No intelligent demand forecasting
Basic feedback collection

Online payments such as GCash, cards, and e-wallets are outside the current POS scope.

🚀 Future Improvements

Potential future improvements include:

Predictive analytics
AI-assisted decision support
Intelligent inventory demand forecasting
Automatic stock replenishment
Expiration monitoring
Online payment integration
Third-party healthcare integrations
More advanced patient communication
Telemedicine capabilities
Advanced analytics and reporting
🎓 Academic Information

Project Title:
Web-Based Optical Management System with Data Analytics for Everbright Optical Clinic

Program:
Bachelor of Science in Information Technology

Institution:
University of Cabuyao (Pamantasan ng Cabuyao)

College:
College of Computing Studies

Year:
2025

Researchers
Genesis M. Abanales
Rozz Hill A. De Guzman
Johnro C. Malitic
Almer Jann P. Protacio

The capstone document identifies the project title, researchers, program, institution, and December 2025 completion date.

👨‍💻 Contributors

This project was developed as a collaborative academic capstone project by the researchers listed above.

📄 License

This project was developed for academic and educational purposes as a Bachelor of Science in Information Technology capstone project.

⭐ Acknowledgment

Developed for Everbright Optical Clinic as part of the Bachelor of Science in Information Technology capstone project at the University of Cabuyao (Pamantasan ng Cabuyao).
