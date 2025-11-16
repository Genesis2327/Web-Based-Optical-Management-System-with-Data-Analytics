<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analytics Report - {{ $generatedAt->format('F Y') }}</title>
    <style>
        @page {
            margin: 1.5cm;
            size: A4 portrait;
        }
        
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            color: #000000;
            line-height: 1.6;
            background: #ffffff;
        }
        
        .header {
            text-align: center;
            border-bottom: 4px double #000000;
            padding-bottom: 15pt;
            margin-bottom: 20pt;
        }
        
        .header h1 {
            font-size: 20pt;
            font-weight: bold;
            margin-bottom: 5pt;
            letter-spacing: 1px;
            color: #000000;
        }
        
        .header .company-name {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 3pt;
            color: #000000;
        }
        
        .header .report-type {
            font-size: 12pt;
            font-style: italic;
            color: #333333;
            margin-top: 3pt;
        }
        
        .header .report-date {
            font-size: 10pt;
            color: #555555;
            margin-top: 5pt;
        }
        
        .report-metadata {
            background: #f9f9f9;
            border: 1px solid #000000;
            padding: 10pt;
            margin-bottom: 20pt;
            font-size: 10pt;
        }
        
        .report-metadata table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .report-metadata td {
            padding: 4pt 8pt;
            border: none;
        }
        
        .report-metadata td:first-child {
            font-weight: bold;
            width: 35%;
            color: #000000;
        }
        
        .report-metadata td:last-child {
            color: #333333;
        }
        
        .section {
            margin-bottom: 25pt;
            page-break-inside: avoid;
        }
        
        .section-title {
            font-size: 14pt;
            font-weight: bold;
            color: #000000;
            border-bottom: 2px solid #000000;
            padding-bottom: 5pt;
            margin-bottom: 12pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .metrics-container {
            display: table;
            width: 100%;
            margin-bottom: 15pt;
        }
        
        .metric-row {
            display: table-row;
        }
        
        .metric-box {
            display: table-cell;
            width: 25%;
            border: 1px solid #000000;
            padding: 10pt;
            text-align: center;
            vertical-align: middle;
            background: #ffffff;
        }
        
        .metric-value {
            font-size: 16pt;
            font-weight: bold;
            color: #000000;
            margin-bottom: 3pt;
        }
        
        .metric-label {
            font-size: 9pt;
            color: #333333;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10pt;
            font-size: 10pt;
            border: 1px solid #000000;
        }
        
        .data-table th {
            background: #e0e0e0;
            font-weight: bold;
            color: #000000;
            padding: 8pt;
            text-align: left;
            border: 1px solid #000000;
            border-bottom: 2px solid #000000;
            text-transform: uppercase;
            font-size: 9pt;
            letter-spacing: 0.3px;
        }
        
        .data-table td {
            padding: 7pt 8pt;
            border: 1px solid #cccccc;
            color: #000000;
        }
        
        .data-table tr:nth-child(even) {
            background: #f9f9f9;
        }
        
        .data-table tr:hover {
            background: #f0f0f0;
        }
        
        .text-right {
            text-align: right;
        }
        
        .text-center {
            text-align: center;
        }
        
        .text-bold {
            font-weight: bold;
        }
        
        .footer {
            margin-top: 30pt;
            padding-top: 10pt;
            border-top: 1px solid #000000;
            text-align: center;
            font-size: 9pt;
            color: #666666;
        }
        
        .footer-line {
            margin: 3pt 0;
        }
        
        .page-number {
            position: fixed;
            bottom: 1cm;
            right: 1.5cm;
            font-size: 9pt;
            color: #666666;
        }
        
        .no-data {
            text-align: center;
            padding: 15pt;
            font-style: italic;
            color: #666666;
        }
        
        @media print {
            .section { 
                page-break-inside: avoid; 
            }
            
            .page-number::after {
                content: "Page " counter(page);
            }
        }
    </style>
</head>
<body>
    <!-- Report Header -->
    <div class="header">
        <div class="company-name">OPTICAL CLINIC MANAGEMENT SYSTEM</div>
        <h1>ANALYTICS REPORT</h1>
        <div class="report-type">Business Performance Analysis</div>
        <div class="report-date">Report Period: {{ $startDate->format('F d, Y') }} to {{ $endDate->format('F d, Y') }}</div>
        <div class="report-date">Generated: {{ $generatedAt->format('F d, Y \a\t g:i A') }}</div>
    </div>

    <!-- Report Metadata -->
    <div class="report-metadata">
        <table>
            <tr>
                <td>Report Period:</td>
                <td>{{ $startDate->format('F d, Y') }} to {{ $endDate->format('F d, Y') }} ({{ $period }} days)</td>
            </tr>
            <tr>
                <td>Report Scope:</td>
                <td>
                    @if($branchName)
                        Branch: {{ $branchName }}
                    @else
                        All Branches (System-wide)
                    @endif
                </td>
            </tr>
            <tr>
                <td>Prepared By:</td>
                <td>{{ $generatedBy }}</td>
            </tr>
            <tr>
                <td>Report Date:</td>
                <td>{{ $generatedAt->format('F d, Y') }}</td>
            </tr>
            <tr>
                <td>Report Time:</td>
                <td>{{ $generatedAt->format('g:i A') }}</td>
            </tr>
        </table>
    </div>

    <!-- Revenue Analysis Section -->
    <div class="section">
        <div class="section-title">Revenue Analysis</div>
        <div class="metrics-container">
            <div class="metric-row">
                <div class="metric-box">
                    <div class="metric-value">PHP {{ number_format($analytics['revenue']['total'], 2) }}</div>
                    <div class="metric-label">Total Revenue</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">{{ number_format($analytics['patients']['unique_total'] ?? 0) }}</div>
                    <div class="metric-label">Total Patients</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">{{ number_format($analytics['appointments']['total']) }}</div>
                    <div class="metric-label">Total Appointments</div>
                </div>
            </div>
        </div>
        @if(isset($analytics['revenue']['receipts']) || isset($analytics['revenue']['reservations']) || isset($analytics['revenue']['transactions']))
        <table class="data-table" style="margin-top: 10pt;">
            <thead>
                <tr>
                    <th>Revenue Source</th>
                    <th class="text-right">Amount (PHP)</th>
                </tr>
            </thead>
            <tbody>
                @if(isset($analytics['revenue']['receipts']) && $analytics['revenue']['receipts'] > 0)
                <tr>
                    <td>Receipts</td>
                    <td class="text-right">PHP {{ number_format($analytics['revenue']['receipts'], 2) }}</td>
                </tr>
                @endif
                @if(isset($analytics['revenue']['reservations']) && $analytics['revenue']['reservations'] > 0)
                <tr>
                    <td>Reservations</td>
                    <td class="text-right">PHP {{ number_format($analytics['revenue']['reservations'], 2) }}</td>
                </tr>
                @endif
                @if(isset($analytics['revenue']['transactions']) && $analytics['revenue']['transactions'] > 0)
                <tr>
                    <td>Transactions</td>
                    <td class="text-right">PHP {{ number_format($analytics['revenue']['transactions'], 2) }}</td>
                </tr>
                @endif
                <tr style="background: #e8f4f8; font-weight: bold;">
                    <td>Total Revenue</td>
                    <td class="text-right">PHP {{ number_format($analytics['revenue']['total'], 2) }}</td>
                </tr>
            </tbody>
        </table>
        @endif
    </div>

    <!-- Appointment Analysis Section -->
    <div class="section">
        <div class="section-title">Appointment Analysis</div>
        <div class="metrics-container">
            <div class="metric-row">
                <div class="metric-box">
                    <div class="metric-value">{{ $analytics['appointments']['total'] }}</div>
                    <div class="metric-label">Total Appointments</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value" style="color: #006600;">{{ $analytics['appointments']['completed'] }}</div>
                    <div class="metric-label">Completed</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value" style="color: #990000;">{{ $analytics['appointments']['cancelled'] }}</div>
                    <div class="metric-label">Cancelled</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">{{ number_format($analytics['appointments']['completion_rate'], 1) }}%</div>
                    <div class="metric-label">Completion Rate</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Customer Feedback Analysis Section -->
    <div class="section">
        <div class="section-title">Customer Feedback Analysis</div>
        <div class="metrics-container">
            <div class="metric-row">
                <div class="metric-box">
                    <div class="metric-value">{{ $analytics['feedback']['total'] }}</div>
                    <div class="metric-label">Total Feedback</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">{{ number_format($analytics['feedback']['avg_rating'], 2) }}</div>
                    <div class="metric-label">Average Rating (Out of 5.0)</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">{{ $analytics['feedback']['unique_customers'] }}</div>
                    <div class="metric-label">Unique Customers</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value">{{ number_format($analytics['feedback']['response_rate'], 1) }}%</div>
                    <div class="metric-label">Response Rate</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Branch Performance Section -->
    @if(count($analytics['branch_performance']) > 0)
    <div class="section">
        <div class="section-title">Branch Performance Analysis</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Branch Name</th>
                    <th class="text-center">Appointments</th>
                    <th class="text-right">Revenue (PHP)</th>
                    <th class="text-center">Average Rating</th>
                </tr>
            </thead>
            <tbody>
                @foreach($analytics['branch_performance'] as $branch)
                <tr>
                    <td class="text-bold">{{ $branch['name'] }}</td>
                    <td class="text-center">{{ number_format($branch['appointments']) }}</td>
                    <td class="text-right">PHP {{ number_format($branch['revenue'], 2) }}</td>
                    <td class="text-center">{{ number_format($branch['avg_rating'], 2) }} / 5.0</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    <!-- Revenue Distribution Section -->
    @if(isset($analytics['revenue_distribution']) && count($analytics['revenue_distribution']) > 0)
    <div class="section">
        <div class="section-title">Revenue Distribution by Time Period</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Period</th>
                    <th class="text-right">Receipts</th>
                    <th class="text-right">Reservations</th>
                    <th class="text-right">Transactions</th>
                    <th class="text-right">Total Revenue</th>
                    <th class="text-center">% of Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($analytics['revenue_distribution'] as $dist)
                <tr>
                    <td class="text-bold">{{ $dist['period'] }}</td>
                    <td class="text-right">PHP {{ number_format($dist['receipts'], 2) }}</td>
                    <td class="text-right">PHP {{ number_format($dist['reservations'], 2) }}</td>
                    <td class="text-right">PHP {{ number_format($dist['transactions'], 2) }}</td>
                    <td class="text-right text-bold">PHP {{ number_format($dist['revenue'], 2) }}</td>
                    <td class="text-center">{{ number_format($dist['percentage'], 1) }}%</td>
                </tr>
                @endforeach
                <tr style="background: #e8f4f8; font-weight: bold;">
                    <td>TOTAL</td>
                    <td class="text-right">PHP {{ number_format($analytics['revenue']['receipts'] ?? 0, 2) }}</td>
                    <td class="text-right">PHP {{ number_format($analytics['revenue']['reservations'] ?? 0, 2) }}</td>
                    <td class="text-right">PHP {{ number_format($analytics['revenue']['transactions'] ?? 0, 2) }}</td>
                    <td class="text-right">PHP {{ number_format($analytics['revenue']['total'], 2) }}</td>
                    <td class="text-center">100.0%</td>
                </tr>
            </tbody>
        </table>
    </div>
    @endif

    <!-- Top Services Section -->
    @if(count($analytics['top_services']) > 0)
    <div class="section">
        <div class="section-title">Service Type Distribution</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Service Type</th>
                    <th class="text-center">Count</th>
                    <th class="text-center">Percentage</th>
                </tr>
            </thead>
            <tbody>
                @foreach($analytics['top_services'] as $service)
                <tr>
                    <td class="text-bold">{{ ucwords(str_replace(['_', '-'], ' ', $service->type)) }}</td>
                    <td class="text-center">{{ number_format($service->count) }}</td>
                    <td class="text-center">{{ $analytics['appointments']['total'] > 0 ? number_format(($service->count / $analytics['appointments']['total']) * 100, 1) : '0.0' }}%</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    <!-- Report Footer -->
    <div class="footer">
        <div class="footer-line">This is an official business report generated by the Optical Clinic Management System</div>
        <div class="footer-line">Report generated on {{ $generatedAt->format('F d, Y \a\t g:i A') }}</div>
        <div class="footer-line">Confidential - For Internal Use Only</div>
    </div>
    
    <div class="page-number"></div>
</body>
</html>