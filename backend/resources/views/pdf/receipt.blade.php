<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Official Receipt - Everbright Optical Clinic</title>
    <style>
        * {
            box-sizing: border-box;
        }

        @charset "UTF-8";
        
        body {
            font-family: 'DejaVu Sans', 'Arial', sans-serif;
            font-size: 11px;
            line-height: 1.3;
            color: #333;
            margin: 0;
            padding: 15px;
            background: #fff;
            -webkit-font-smoothing: antialiased;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #2563eb;
        }

        .clinic-details {
            flex: 1;
        }

        .clinic-name {
            font-size: 18px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .clinic-info {
            font-size: 9px;
            color: #666;
            margin-bottom: 2px;
            line-height: 1.2;
        }

        .clinic-address {
            font-size: 8px;
            color: #888;
            margin-top: 2px;
        }

        .invoice-info {
            text-align: right;
            min-width: 180px;
        }

        .invoice-title {
            font-size: 14px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 8px;
            background: #f8fafc;
            padding: 5px 10px;
            border-radius: 3px;
            text-align: center;
        }

        .invoice-details {
            font-size: 10px;
        }

        .invoice-details div {
            margin-bottom: 3px;
        }

        .payment-type {
            background: #f8fafc;
            padding: 8px 12px;
            margin: 10px 0;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
        }

        .checkbox-group {
            display: flex;
            gap: 20px;
        }

        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            font-weight: 500;
        }

        .customer-section {
            background: #f9fafb;
            padding: 12px;
            margin: 12px 0;
            border-radius: 4px;
            border-left: 3px solid #2563eb;
        }

        .section-title {
            font-size: 11px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .customer-info {
            font-size: 10px;
            line-height: 1.4;
        }

        .customer-info div {
            margin-bottom: 3px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 10px;
        }

        .items-table th {
            background: #f1f5f9;
            color: #374151;
            font-weight: bold;
            padding: 8px 6px;
            text-align: center;
            border: 1px solid #e5e7eb;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .items-table td {
            padding: 6px 6px;
            border: 1px solid #e5e7eb;
            text-align: center;
            vertical-align: top;
        }

        .items-table .description {
            text-align: left;
            font-weight: 500;
        }

        .items-table .amount {
            text-align: right;
            font-weight: 600;
            color: #1f2937;
        }

        .totals-section {
            margin-top: 20px;
            display: flex;
            gap: 30px;
        }

        .vat-summary, .amount-summary {
            flex: 1;
        }

        .summary-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
        }

        .summary-table td {
            padding: 4px 6px;
            border: 1px solid #e5e7eb;
            vertical-align: top;
        }

        .summary-table .label {
            font-weight: 600;
            background: #f8fafc;
        }

        .summary-table .value {
            text-align: right;
            font-weight: 600;
        }

        .total-row {
            background: #fef3c7 !important;
            border: 2px solid #f59e0b !important;
            font-weight: bold !important;
            font-size: 11px !important;
        }

        .total-row .label {
            background: #fef3c7;
        }

        .remarks-section {
            background: #fefefe;
            padding: 8px;
            margin: 15px 0;
            border-radius: 3px;
            border: 1px solid #e5e7eb;
        }

        .remarks-content {
            font-size: 9px;
            color: #666;
            background: #f9fafb;
            padding: 6px;
            border-radius: 2px;
        }

        .signature-section {
            margin-top: 25px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        .receiver-section {
            flex: 1;
        }

        .cashier-section {
            text-align: right;
            flex: 0 0 200px;
        }

        .signature-label {
            font-size: 9px;
            color: #666;
            margin-bottom: 15px;
            font-weight: 500;
        }

        .signature-line {
            border-bottom: 1px solid #333;
            width: 180px;
            height: 30px;
            display: inline-block;
            margin-top: 5px;
        }

        .footer-info {
            margin-top: 20px;
            text-align: center;
            font-size: 7px;
            color: #888;
            border-top: 1px solid #e5e7eb;
            padding-top: 8px;
        }

        .bir-details {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        }

        .bir-line {
            border-bottom: 1px dotted #ccc;
            flex: 1;
            margin: 0 10px;
            height: 1px;
        }

        .page-break {
            page-break-before: always;
        }

        @media print {
            body {
                padding: 10px;
                font-size: 10px;
            }

            .items-table {
                font-size: 9px;
            }

            .summary-table {
                font-size: 8px;
            }
        }
    </style>
</head>
<body>
    <!-- Header Section -->
    <div class="header">
        <div class="clinic-details">
            <div class="clinic-name">EVERBRIGHT OPTICAL CLINIC</div>
            <div class="clinic-info">Owned & Operated by EVERBRIGHT CLINIC OPC</div>
            <div class="clinic-info">VAT Reg. TIN: 600-781-251-00000</div>
            <div class="clinic-address">
                47 & 48 2F Unitop Balibago Commercial Complex<br>
                Balibago, Santa Rosa City, Laguna 4025<br>
                Philippines
            </div>
        </div>

        <div class="invoice-info">
            <div class="invoice-title">OFFICIAL RECEIPT</div>
            <div class="invoice-details">
                <div><strong>Receipt No.:</strong> {{ $invoice_no }}</div>
                <div><strong>Date:</strong> {{ date('M j, Y', strtotime($date)) }}</div>
                <div><strong>Time:</strong> {{ date('h:i A') }}</div>
            </div>
        </div>
    </div>

    <!-- Payment Type -->
    <div class="payment-type">
        <div class="checkbox-group">
            <label class="checkbox-item">
                <input type="checkbox" {{ $sales_type === 'cash' ? 'checked' : '' }}>
                <span>CASH SALES</span>
            </label>
            <label class="checkbox-item">
                <input type="checkbox" {{ $sales_type === 'charge' ? 'checked' : '' }}>
                <span>CHARGE SALES</span>
            </label>
        </div>
    </div>

    <!-- Customer Information -->
    <div class="customer-section">
        <div class="section-title">Bill To:</div>
        <div class="customer-info">
            <div><strong>{{ $customer_name }}</strong></div>
            @if($tin && $tin !== 'N/A')
            <div><strong>TIN:</strong> {{ $tin }}</div>
            @endif
            <div><strong>Address:</strong> {{ $address ?: 'N/A' }}</div>
        </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
        <thead>
            <tr>
                <th class="description" style="width: 50%; text-align: left;">Description / Nature of Service</th>
                <th style="width: 15%;">Quantity</th>
                <th style="width: 20%;">Unit Price</th>
                <th style="width: 15%;">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $index => $item)
            <tr>
                <td class="description">{{ $item['description'] }}</td>
                <td>{{ number_format($item['qty']) }}</td>
                <td class="amount">P {{ number_format($item['unit_price'], 2) }}</td>
                <td class="amount">P {{ number_format($item['amount'], 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <!-- VAT Calculation Summary -->
    <div class="totals-section">
        <div class="vat-summary">
            <table class="summary-table">
                <tr>
                    <td class="label" style="width: 50%;"><strong>Vatable Sales</strong></td>
                    <td class="value" style="width: 50%;">P {{ number_format($vatable_sales, 2) }}</td>
                </tr>
                <tr>
                    <td class="label"><strong>VAT Amount</strong></td>
                    <td class="value">P {{ number_format($vat_amount, 2) }}</td>
                </tr>
                <tr>
                    <td class="label"><strong>Zero Rated Sales</strong></td>
                    <td class="value">P {{ number_format($zero_rated_sales, 2) }}</td>
                </tr>
                <tr>
                    <td class="label"><strong>VAT-Exempt Sales</strong></td>
                    <td class="value">P {{ number_format($vat_exempt_sales, 2) }}</td>
                </tr>
                <tr>
                    <td class="label"><strong>Discount</strong></td>
                    <td class="value">P {{ number_format($discount, 2) }}</td>
                </tr>
            </table>
        </div>

        <div class="amount-summary">
            <table class="summary-table">
                <tr>
                    <td class="label"><strong>Total Sales (VAT Inclusive)</strong></td>
                    <td class="value">P {{ number_format($vatable_sales + $add_vat, 2) }}</td>
                </tr>
                <tr>
                    <td class="label"><strong>Less: VAT</strong></td>
                    <td class="value">P {{ number_format($less_vat, 2) }}</td>
                </tr>
                <tr>
                    <td class="label"><strong>Amount Net of VAT</strong></td>
                    <td class="value">P {{ number_format($net_of_vat, 2) }}</td>
                </tr>
                <tr>
                    <td class="label"><strong>Add: VAT</strong></td>
                    <td class="value">P {{ number_format($add_vat, 2) }}</td>
                </tr>
                <tr>
                    <td class="label"><strong>Less: Withholding Tax</strong></td>
                    <td class="value">P {{ number_format($withholding_tax, 2) }}</td>
                </tr>
                <tr class="total-row">
                    <td class="label"><strong>TOTAL AMOUNT DUE</strong></td>
                    <td class="value"><strong>P {{ number_format($total_due, 2) }}</strong></td>
                </tr>
            </table>
        </div>
    </div>

    <!-- Remarks Section (Optional) -->
    @if($discount > 0)
    <div class="remarks-section">
        <div class="section-title">Discount Remarks:</div>
        <div class="remarks-content">
            Senior Citizen/PWD/NAAC/MOV/Solo Parent Discount Applied
        </div>
    </div>
    @endif

    <!-- Signature Section -->
    <div class="signature-section">
        <div class="receiver-section">
            <div class="signature-label">RECEIVED the amount indicated above:</div>
            <div style="margin-top: 30px; border-bottom: 1px solid #333; width: 250px;"></div>
            <div style="margin-top: 5px; font-size: 9px; color: #666;">
                Customer/Representative Signature
            </div>
        </div>

        <div class="cashier-section">
            <div class="signature-label">RECEIVED PAYMENT:</div>
            <div class="signature-line"></div>
            <div style="margin-top: 5px; font-size: 9px; color: #666;">
                Cashier/Authorized Representative
            </div>
        </div>
    </div>

    <!-- BIR Compliance Footer -->
    <div class="footer-info">
        <div class="bir-details">
            <span>Booklet No. _______________</span>
            <span class="bir-line"></span>
            <span>Series No. _______________</span>
        </div>
        <div style="margin: 5px 0;">
            BIR Authority to Print OCN: _______________ &nbsp;&nbsp;|&nbsp;&nbsp;
            Date Issued: _______________
        </div>
        <div style="font-size: 6px; color: #999; margin-top: 8px;">
            This Official Receipt shall be valid for Five (5) years from the date of ATP. • BIR-registered establishment
        </div>
    </div>

    <!-- Terms & Conditions (Optional - can be enabled later) -->
    {{-- <div style="margin-top: 15px; font-size: 7px; color: #888; text-align: justify;">
        TERMS & CONDITIONS: All sales are final. Returns accepted within 7 days with proof of purchase.
        Warranty applies to manufacturing defects only. Service charges are non-refundable.
        Please keep this receipt for warranty claims.
    </div> --}}
</body>
</html>
