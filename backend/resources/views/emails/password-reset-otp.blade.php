<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Code - Everbright Optical Clinic</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Simple Header -->
                    <tr>
                        <td style="background-color: #2563eb; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">Everbright Optical Clinic</h1>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">Password Reset Code</h2>
                            <p style="color: #4b5563; margin: 0 0 30px 0; font-size: 15px; line-height: 1.6;">
                                We received a request to reset your password. Please use the code below to complete the process.
                            </p>
                            
                            <!-- OTP Code Display -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; margin: 30px 0;">
                                <tr>
                                    <td style="padding: 30px; text-align: center;">
                                        <p style="color: #1e40af; margin: 0 0 15px 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Reset Code</p>
                                        <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; display: inline-block; border: 1px solid #dbeafe;">
                                            <span style="font-size: 32px; font-weight: 700; letter-spacing: 10px; color: #2563eb; font-family: 'Courier New', monospace;">{{ $otp }}</span>
                                        </div>
                                        <p style="color: #64748b; margin: 15px 0 0 0; font-size: 13px;">
                                            Valid for 5 minutes
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Simple Instructions -->
                            <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 30px 0; border-left: 3px solid #2563eb;">
                                <p style="color: #374151; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Instructions:</p>
                                <ol style="color: #6b7280; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                                    <li>Enter this code on the password reset page</li>
                                    <li>Create a new secure password</li>
                                    <li>Sign in with your new password</li>
                                </ol>
                            </div>
                            
                            <!-- Security Notice -->
                            <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border: 1px solid #fde68a; margin: 30px 0;">
                                <p style="color: #92400e; margin: 0; font-size: 13px; line-height: 1.6;">
                                    <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email or contact support if you have concerns.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Simple Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                                &copy; {{ date('Y') }} Everbright Optical Clinic. All rights reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
