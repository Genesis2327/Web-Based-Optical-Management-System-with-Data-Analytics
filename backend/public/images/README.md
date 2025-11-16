# Email Images Directory

Place your logo/image files here for use in email templates.

## Recommended Files:
- `everbright-logo.png` - Main logo (recommended: 200px width, PNG format)
- `logo.png` - Alternative logo name

## Image Requirements:
- **Format**: PNG or JPG
- **Size**: Recommended max 200px width
- **File Size**: Keep under 100KB for faster email loading
- **Dimensions**: Square or landscape orientation works best

## Usage in Emails:
The email template will automatically use the logo if it exists at:
- `public/images/everbright-logo.png` (preferred)
- `public/images/logo.png` (fallback)

## Note:
Make sure `APP_URL` in `.env` is set correctly so the image URL works in emails.

