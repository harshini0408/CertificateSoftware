import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

search_str = '''  return (
    <div className="space-y-4">
      <DataTable'''

replace_str = '''  const handleExport = async () => {
    try {
      const response = await axiosInstance.get(/clubs//events//participants/export, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', participants_.xlsx)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
    } catch (err) {
      console.error("Export failed", err)
      alert("Failed to export participants")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleExport} className="btn-secondary text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export to Excel
        </button>
      </div>
      <DataTable'''

text = text.replace(search_str, replace_str)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print("Done.")
