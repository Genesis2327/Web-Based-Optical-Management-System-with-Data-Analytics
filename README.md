<div align="center">

# 👓 EverBright Optical Clinic System

### Web-Based Optical Management System with Data Analytics

A centralized web-based platform for managing **patients, appointments, prescriptions, inventory, point-of-sale transactions, and clinic analytics**.

<br>

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Laravel](https://img.shields.io/badge/Laravel-PHP-FF2D20?style=for-the-badge&logo=laravel&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)

<br>

**🎓 Bachelor of Science in Information Technology Capstone Project**

**University of Cabuyao (Pamantasan ng Cabuyao)**  
College of Computing Studies • 2025

</div>

---

## 📖 About the Project

The **EverBright Optical Clinic System** is a web-based optical management platform developed to digitize and centralize the daily operations of EverBright Optical Clinic.

The system integrates multiple clinic processes into one platform:

- 👤 Patient Management
- 📅 Appointment Management
- 👓 Vision & Prescription Management
- 📦 Inventory Management
- 🛒 Point of Sale (POS)
- 📊 Data Analytics
- 🏢 Multi-Branch Management
- 🔔 Customer Notifications
- 📝 Feedback & Client Tracking

The system was designed to reduce manual processes, improve data accuracy, streamline clinic operations, and provide management with useful descriptive analytics.

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 👤 Patient Management

- Patient registration & login
- Patient profiles
- Demographic information
- Vision history
- Prescription history
- Appointment history
- Patient feedback

</td>

<td width="50%">

### 📅 Appointment Management

- Online appointment booking
- Appointment scheduling
- Appointment history
- Appointment reminders
- Branch-based appointments
- Optometrist scheduling

</td>
</tr>

<tr>
<td>

### 👓 Prescription Management

- Digital prescriptions
- Right & left eye information
- Prescription history
- Prescription expiration
- Electronic prescription viewing
- Optometrist prescription creation

</td>

<td>

### 📦 Inventory Management

- Product management
- Real-time stock monitoring
- Low-stock alerts
- Reorder levels
- Branch-based inventory
- ABC inventory analysis

</td>
</tr>

<tr>
<td>

### 🛒 Point of Sale

- Product transactions
- Automatic calculations
- Digital receipts
- Sales records
- Inventory deduction
- Revenue tracking

</td>

<td>

### 📊 Data Analytics

- Revenue analytics
- Appointment analytics
- Patient demographics
- Sales trends
- Prescription trends
- Branch performance
- Interactive dashboards

</td>
</tr>

<tr>
<td>

### 🏢 Multi-Branch

- Four clinic branches
- Branch selector
- Branch-specific records
- Branch performance comparison
- Centralized management

</td>

<td>

### 📱 Responsive Design

- Desktop support
- Mobile support
- Responsive dashboards
- Responsive product galleries
- Mobile-friendly interface

</td>
</tr>
</table>

---

# 🖥️ System Preview

> 📸 Add screenshots of your actual system below.

### 📊 Analytics Dashboard

<p align="center">
  <img src="docs/screenshots/dashboard.png" width="90%" alt="Analytics Dashboard">
</p>

### 👤 Patient Management

<p align="center">
  <img src="docs/screenshots/patients.png" width="90%" alt="Patient Management">
</p>

### 📦 Inventory Management

<p align="center">
  <img src="docs/screenshots/inventory.png" width="90%" alt="Inventory Management">
</p>

### 🛒 Point of Sale

<p align="center">
  <img src="docs/screenshots/pos.png" width="90%" alt="Point of Sale">
</p>

---

# 🏗️ System Architecture

```text
                         ┌─────────────────────┐
                         │       USERS         │
                         │                     │
                         │ Admin               │
                         │ Clinic Staff        │
                         │ Optometrist         │
                         │ Patient             │
                         └──────────┬──────────┘
                                    │
                                    ▼
                     ┌──────────────────────────┐
                     │       FRONTEND           │
                     │                          │
                     │ React.js                 │
                     │ Bootstrap               │
                     │ Tailwind CSS             │
                     │ React Query              │
                     │ Recharts                 │
                     └────────────┬─────────────┘
                                  │
                              REST API
                                  │
                                  ▼
                     ┌──────────────────────────┐
                     │        BACKEND           │
                     │                          │
                     │ Laravel                  │
                     │ PHP                      │
                     │ Authentication           │
                     │ Business Logic           │
                     │ Role-Based Access        │
                     └────────────┬─────────────┘
                                  │
                                  ▼
                     ┌──────────────────────────┐
                     │        DATABASE          │
                     │                          │
                     │ SQLite Development       │
                     │ MySQL Production         │
                     └──────────────────────────┘
