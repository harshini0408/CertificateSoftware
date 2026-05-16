# Department Certificate Templates

This folder stores the static certificate templates for each department.

## File Naming Convention

Name your certificate templates by department name (CSE, ECE, EEE, etc):
- `CSE.png` - Computer Science & Engineering template
- `ECE.png` - Electronics & Communication Engineering template
- `EEE.png` - Electrical & Electronics Engineering template
- `MECH.png` - Mechanical Engineering template
- `CIVIL.png` - Civil Engineering template

## How It Works

1. **First-time Setup**: 
   - Department coordinators upload their certificate template PNG via the `/dept/certificates/template/upload` endpoint
   - The file is automatically saved with the department slug name
   - Example: If logged in as "CSE" coordinator, the file will be saved as `CSE.png`

2. **Field Position Configuration**:
   - After uploading the template, coordinators configure where text fields should appear
   - They define positions (x%, y%) and font size for: name, class, contribution
   - These positions are saved in the DeptAsset document

3. **Certificate Generation**:
   - When generating certificates, the system uses the stored template and field positions
   - Text overlays are placed exactly where configured
   - Logos and signatures are overlaid automatically

## Upload via API

```bash
curl -X POST "http://localhost:8000/dept/certificates/template/upload" \
  -H "Authorization: Bearer <token>" \
  -F "template_file=@CSE.png"
```

## Configure Field Positions

```bash
curl -X POST "http://localhost:8000/dept/certificates/field-positions" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": {
      "x_percent": 50.0,
      "y_percent": 46.0,
      "font_size": 28
    },
    "class": {
      "x_percent": 50.0,
      "y_percent": 56.0,
      "font_size": 22
    },
    "contribution": {
      "x_percent": 50.0,
      "y_percent": 64.0,
      "font_size": 22
    }
  }'
```

## Get Saved Configuration

```bash
curl -X GET "http://localhost:8000/dept/certificates/field-positions" \
  -H "Authorization: Bearer <token>"
```

## Check Asset Status

```bash
curl -X GET "http://localhost:8000/dept/certificates/assets-status" \
  -H "Authorization: Bearer <token>"
```
