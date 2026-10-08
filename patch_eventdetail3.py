path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

old = '''              <div className="sm:col-span-2">
                <label className="form-label text-xs font-semibold">Venue *</label>
                <input
                  type="text"
                  value={editVenue}
                  onChange={(e) => setEditVenue(e.target.value)}
                  required
                  className="form-input text-sm"
                  placeholder="e.g. Lab 3 / Auditorium"
                />
              </div>
            </div>'''

new = '''              <div className="sm:col-span-2">
                <label className="form-label text-xs font-semibold">Venue *</label>
                <input
                  type="text"
                  value={editVenue}
                  onChange={(e) => setEditVenue(e.target.value)}
                  required
                  className="form-input text-sm"
                  placeholder="e.g. Lab 3 / Auditorium"
                />
              </div>
              <div>
                <label className="form-label text-xs font-semibold">Max Participants (Optional)</label>
                <input
                  type="number"
                  min="0"
                  value={editMaxParticipants}
                  onChange={(e) => setEditMaxParticipants(e.target.value)}
                  className="form-input text-sm"
                  placeholder="No limit"
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank for no limit. Students will see &ldquo;Maximum participants reached&rdquo; when full.</p>
              </div>
            </div>'''

text = text.replace(old, new)
with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print("Done.")
