# Department Certificate Template Naming Guide

## Standard Department Names

Use these exact filenames when uploading your certificate templates to:
`backend/storage/dept_templates/`

### Common Engineering Departments

| Department | Filename | Example |
|-----------|----------|---------|
| Computer Science & Engineering | CSE.png | CSE.png |
| Electronics & Communication Eng. | ECE.png | ECE.png |
| Electrical & Electronics Eng. | EEE.png | EEE.png |
| Mechanical Engineering | MECH.png | MECH.png |
| Civil Engineering | CIVIL.png | CIVIL.png |
| Chemical Engineering | CHEM.png | CHEM.png |
| Aeronautical Engineering | AERO.png | AERO.png |
| Biotechnology | BIO.png | BIO.png |
| Information Technology | IT.png | IT.png |
| Production Engineering | PROD.png | PROD.png |

### Other Common Departments

| Department | Filename | Example |
|-----------|----------|---------|
| Business Administration | MBA.png | MBA.png |
| Master of Technology | MTECH.png | MTECH.png |
| Master of Science | MTECH.png | MTECH.png |
| General / Default | GENERAL.png | GENERAL.png |

## How to Find Your Department Name

1. **Log in** to the platform as a department coordinator
2. **Check** your profile - your department name is shown
3. **Use that name** for your filename

Example:
- If you see "Department: CSE" → Upload `CSE.png`
- If you see "Department: Electronics & Communication Engineering" → Upload `ECE.png`

## File Naming Rules

✅ **Must be PNG format** (.png extension)
✅ **Use UPPERCASE** for department code (CSE.png, not cse.png)
✅ **Use department abbreviation** (ECE, not "Electronics")
✅ **No spaces in filename** (CSE.png, not "CSE Engineering.png")
✅ **One file per department** (CSE.png covers all CSE coordinators)

## Upload Location

All files go in this single folder:
```
backend/storage/dept_templates/
```

**Examples of correct file structure**:
```
backend/storage/dept_templates/
├── CSE.png           ✅ Correct
├── ECE.png           ✅ Correct
├── EEE.png           ✅ Correct
├── MECH.png          ✅ Correct
├── cse.png           ❌ Wrong (lowercase)
├── CSE Engineering.png  ❌ Wrong (spaces)
└── certificate.png   ❌ Wrong (not dept name)
```

## What Happens After Upload

1. **CSE coordinator logs in** → System looks for `CSE.png` → Found! ✅
2. **ECE coordinator logs in** → System looks for `ECE.png` → Found! ✅
3. **Unknown coordinator logs in** → System looks for `UNKNOWN.png` → Not found, uses default template

## If Your Department Name Doesn't Match

**Example**: Your department is listed as "Dept of Computer Science" but you want it to use a template

**Solution**: 
1. Ask admin to add mapping OR
2. Upload template with the exact name used in the system
3. Check the department field by calling `/dept/certificates/assets-status` API

## Quick Copy-Paste Template Names

Ready to go? Copy-paste these filenames and fill them:

```
CSE.png          # Computer Science
ECE.png          # Electronics
EEE.png          # Electrical
MECH.png         # Mechanical
CIVIL.png        # Civil
CHEM.png         # Chemical
AERO.png         # Aeronautical
BIO.png          # Biotechnology
IT.png           # Information Technology
PROD.png         # Production
```

## Contact Support

If your department name:
- Has special characters
- Is very long
- Doesn't fit the naming convention

Please contact the admin to set up the correct mapping.
