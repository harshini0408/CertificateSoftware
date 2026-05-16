import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Trash2, Plus, Save, Mouse, AlertCircle } from 'lucide-react';

const TemplateMapper = ({ templateName, onSave }) => {
  const [fields, setFields] = useState([]);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldNameInput, setFieldNameInput] = useState('');
  const [pendingFieldId, setPendingFieldId] = useState(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    setImageUrl(`http://localhost:8000/static/certificate_templates/${templateName}`);
    loadExistingConfig();
  }, [templateName]);

  const loadExistingConfig = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`http://localhost:8000/api/certificate-config/config/${templateName}`);
      const fieldArray = Object.entries(res.data).map(([name, pos]) => ({
        id: Math.random().toString(36).substr(2, 9),
        field_name: name,
        x: pos.x,
        y: pos.y
      }));
      setFields(fieldArray);
    } catch (err) {
      console.error("Error fetching config:", err);
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  const addNewField = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setFields([...fields, {
      id: newId,
      field_name: '',
      x: null,
      y: null
    }]);
    setPendingFieldId(newId);
    setFieldNameInput('');
  };

  const confirmFieldName = (id) => {
    if (!fieldNameInput.trim()) {
      alert('Please enter a field name');
      return;
    }
    setFields(fields.map(f => f.id === id ? { ...f, field_name: fieldNameInput.trim() } : f));
    setPendingFieldId(null);
    setFieldNameInput('');
  };

  const handleImageClick = (e) => {
    if (!pendingFieldId) {
      alert('Add a field first and name it before clicking on the certificate');
      return;
    }

    const rect = imageRef.current.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    setFields(fields.map(f => 
      f.id === pendingFieldId ? { ...f, x, y } : f
    ));
    setPendingFieldId(null);
  };

  const removeField = (id) => {
    setFields(fields.filter(f => f.id !== id));
    if (pendingFieldId === id) {
      setPendingFieldId(null);
      setFieldNameInput('');
    }
  };

  const handleSave = async () => {
    const incompleteFields = fields.filter(f => !f.field_name || f.x === null || f.y === null);
    if (incompleteFields.length > 0) {
      alert('All fields must have a name and coordinates. Please complete all fields.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        template_name: templateName,
        fields: fields.map(f => ({
          field_name: f.field_name,
          x: f.x,
          y: f.y
        }))
      };
      await axios.post('http://localhost:8000/api/certificate-config/save', payload);
      alert('Configuration saved successfully!');
      if (onSave) onSave();
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden border border-gray-200 shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 text-white">
        <h2 className="text-xl font-bold">{templateName}</h2>
        <p className="text-indigo-100 text-sm mt-1">Add fields, name them, then click on the certificate to set coordinates</p>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main Certificate Display Area */}
        <div className="flex-1 p-6 bg-gray-50 overflow-auto flex items-center justify-center">
          <div 
            className="relative shadow-2xl rounded-sm overflow-hidden bg-white cursor-crosshair border-2 border-transparent hover:border-indigo-400 transition-colors"
            onClick={handleImageClick}
            style={{ maxWidth: '90%', maxHeight: '90%' }}
          >
            <img 
              ref={imageRef}
              src={imageUrl} 
              alt="Certificate Template" 
              className="w-full h-auto block select-none pointer-events-none"
              onError={() => setError("Could not load certificate template image.")}
            />
            
            {/* Field Markers Overlay */}
            {fields.map(f => (
              f.x !== null && f.y !== null && (
                <div 
                  key={f.id}
                  className="absolute flex flex-col items-center group/marker pointer-events-none"
                  style={{ left: `${f.x}%`, top: `${f.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div className="w-5 h-5 bg-green-500 border-3 border-white rounded-full shadow-lg" />
                  <div className="mt-2 px-3 py-1 bg-green-600 text-white text-xs font-bold rounded shadow-lg whitespace-nowrap">
                    {f.field_name}
                  </div>
                </div>
              )
            ))}

            {/* Pending Click Indicator */}
            {pendingFieldId && !fields.find(f => f.id === pendingFieldId)?.x && (
              <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center pointer-events-none">
                <div className="bg-white/95 px-6 py-4 rounded-xl border-2 border-indigo-400 text-center shadow-2xl">
                  <Mouse className="w-8 h-8 mx-auto mb-3 text-indigo-600" />
                  <p className="text-indigo-900 font-bold">Click on the certificate</p>
                  <p className="text-gray-600 text-sm">to set the position for <strong>"{fieldNameInput}"</strong></p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {fields.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10">
                <div className="bg-white/95 px-8 py-6 rounded-xl border-2 border-dashed border-gray-300 text-center">
                  <p className="text-gray-700 font-medium text-lg">No fields added yet</p>
                  <p className="text-gray-500 text-sm mt-1">Add fields from the panel to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Field Management */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-inner overflow-hidden">
          {/* Sidebar Header */}
          <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100">
            <h3 className="text-sm font-bold text-gray-800">Field Configuration</h3>
            <p className="text-xs text-gray-600 mt-1">Total: <span className="font-semibold text-indigo-600">{fields.length}</span> field{fields.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Fields List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {fields.length === 0 ? (
              <div className="text-center py-12 opacity-40">
                <Plus className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-medium text-gray-600">Add your first field</p>
              </div>
            ) : (
              fields.map((field, idx) => (
                <div 
                  key={field.id} 
                  className={`p-4 border rounded-lg transition-all ${
                    pendingFieldId === field.id 
                      ? 'border-indigo-500 bg-indigo-50 shadow-md' 
                      : field.x === null 
                      ? 'border-yellow-300 bg-yellow-50'
                      : 'border-green-300 bg-green-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Field {idx + 1}</span>
                    <button 
                      onClick={() => removeField(field.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Field Name */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700">Field Name</label>
                    <input 
                      type="text"
                      value={field.field_name}
                      readOnly
                      className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded font-medium text-gray-800 cursor-default"
                      placeholder="e.g., Name, Date, Role"
                    />
                  </div>

                  {/* Coordinates Display */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {field.x !== null && field.y !== null ? (
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1 bg-white px-3 py-2 rounded border border-green-200 font-mono font-bold text-green-700">
                          X: {field.x}%
                        </span>
                        <span className="flex-1 bg-white px-3 py-2 rounded border border-green-200 font-mono font-bold text-green-700">
                          Y: {field.y}%
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-yellow-700 font-medium">⚠️ Awaiting coordinates...</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Field Button */}
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            {pendingFieldId ? (
              <div className="space-y-3">
                <input 
                  type="text"
                  value={fieldNameInput}
                  onChange={(e) => setFieldNameInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && confirmFieldName(pendingFieldId)}
                  autoFocus
                  placeholder="e.g., Name, Date, Role"
                  className="w-full px-4 py-2 text-sm border-2 border-indigo-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => confirmFieldName(pendingFieldId)}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Confirm
                  </button>
                  <button 
                    onClick={() => {
                      setPendingFieldId(null);
                      removeField(pendingFieldId);
                      setFieldNameInput('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={addNewField}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Add New Field
              </button>
            )}
          </div>

          {/* Save Button */}
          <div className="p-4 bg-indigo-50 border-t border-indigo-200">
            <button 
              onClick={handleSave}
              disabled={saving || fields.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateMapper;
