path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Add max_participants state and update the handleStartEdit and handleSaveEdit
# 1. Add state
text = text.replace(
    '''  const [editVenue, setEditVenue] = useState('')''',
    "  const [editVenue, setEditVenue] = useState('')\n  const [editMaxParticipants, setEditMaxParticipants] = useState('')"
)

# 2. Populate state on edit start
text = text.replace(
    '''    setEditVenue(event?.venue || '')
    setIsEditing(true)''',
    "    setEditVenue(event?.venue || '')\n    setEditMaxParticipants(event?.max_participants != null ? String(event.max_participants) : '')\n    setIsEditing(true)"
)

# 3. Send in payload
text = text.replace(
    '''        name: editName.trim(),
        event_date: editDate ? ${editDate}T00:00:00 : undefined,
        event_time: editTime.trim(),
        venue: editVenue.trim(),
      },''',
    "        name: editName.trim(),\n        event_date: editDate ? ${editDate}T00:00:00 : undefined,\n        event_time: editTime.trim(),\n        venue: editVenue.trim(),\n        max_participants: editMaxParticipants !== '' ? parseInt(editMaxParticipants, 10) : null,\n      },"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print("Done.")
