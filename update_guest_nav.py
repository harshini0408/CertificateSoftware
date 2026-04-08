
import os
import re

def update_sidebar():
    path = r'd:\CertificateSoftware\frontend\src\components\Sidebar.jsx'
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Update icons.dashboard and icons.certificate mapping
    new_content = re.sub(
        r"case 'guest':\s*return\s*\[.*?\]",
        "case 'guest':\n      return [\n        { to: '/guest',         icon: icons.dashboard,   label: 'Home',    end: true },\n        { to: '/guest/history', icon: icons.certificate, label: 'History', end: false },\n      ]",
        content,
        flags=re.DOTALL
    )
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)

def update_protected_route():
    path = r'd:\CertificateSoftware\frontend\src\components\ProtectedRoute.jsx'
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        if '3. Guest scoping' in line:
            continue
        if 'const { isAuthenticated, role, club_id, event_id } = store' in line:
            new_lines.append('  const { isAuthenticated, role } = store\n')
            continue
        if 'const params = useParams()' in line:
            continue
        new_lines.append(line)
    
    content = "".join(new_lines)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def update_guest_dashboard():
    path = r'd:\CertificateSoftware\frontend\src\pages\GuestDashboard.jsx'
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add imports
    if 'import Navbar' not in content:
        content = "import Navbar from '../components/Navbar'\nimport Sidebar from '../components/Sidebar'\n" + content

    # Wrap layouts
    if 'flex min-h-screen flex-col' not in content:
        # This is a bit complex for regex, using simplified replace
        content = content.replace(
            'return (\n    <div className="p-6 max-w-7xl mx-auto space-y-8">',
            'return (\n    <div className="flex min-h-screen flex-col">\n      <Navbar />\n      <div className="flex flex-1 overflow-hidden">\n        <Sidebar />\n        <main className="flex-1 overflow-y-auto p-6">\n          <div className="max-w-7xl mx-auto space-y-8">',
        )
        content = content.replace(
            '      </div>\n    </div>\n  )\n}',
            '          </div>\n        </main>\n      </div>\n    </div>\n  )\n}'
        )
        # Also need to fix the session conditional return
        content = content.replace(
            'if (submittedName) {\n    return (\n      <div className="p-6 max-w-7xl mx-auto space-y-8">',
            'if (submittedName) {\n    return (\n      <div className="flex min-h-screen flex-col">\n        <Navbar />\n        <div className="flex flex-1 overflow-hidden">\n          <Sidebar />\n          <main className="flex-1 overflow-y-auto p-6">\n            <div className="max-w-7xl mx-auto space-y-8">'
        )
        # Close the div/main tags for the conditional return
        content = content.replace(
            '      </div>\n    )\n  }',
            '            </div>\n          </main>\n        </div>\n      </div>\n    )\n  }'
        )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    update_sidebar()
    update_protected_route()
    update_guest_dashboard()
    print('Guest dashboard navigation updates complete.')
