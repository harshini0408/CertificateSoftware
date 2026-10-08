import sys

path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\index.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

search_str = '''                <div>
                  <label className="form-label" htmlFor="dash-volunteers-required">Volunteers Required</label>'''

replace_str = '''                <div>
                  <label className="form-label" htmlFor="dash-max-participants">Max Participants (Optional)</label>
                  <input
                    id="dash-max-participants"
                    type="number"
                    min="0"
                    className={orm-input }
                    placeholder="No limit"
                    {...register("max_participants", {
                      setValueAs: v => (v === "" || isNaN(v)) ? null : parseInt(v, 10),
                      min: { value: 0, message: "Cannot be negative" }
                    })}
                  />
                  {errors.max_participants && <p className="form-error">{errors.max_participants.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="dash-volunteers-required">Volunteers Required</label>'''

content = content.replace(search_str, replace_str)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done.")
