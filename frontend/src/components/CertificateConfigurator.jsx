import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TemplateMapper from './TemplateMapper';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';

const CertificateConfigurator = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:8000/api/admin/certificate-config/templates');
      setTemplates(res.data);
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading templates...</div>;

  if (selectedTemplate) {
    return (
      <div className="p-6 h-screen flex flex-col">
        <button 
          onClick={() => setSelectedTemplate(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-primary mb-4 w-fit"
        >
          <ArrowLeft size={18} /> Back to Template List
        </button>
        <div className="flex-1 min-h-0">
          <TemplateMapper 
            templateName={selectedTemplate} 
            onSave={() => {}} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Certificate Template Configurator</h1>
        <p className="text-gray-500 mt-2">Visually map Excel column headers to (X, Y) coordinates on PNG templates.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {templates.map((template) => (
          <div 
            key={template}
            onClick={() => setSelectedTemplate(template)}
            className="group bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:border-primary hover:shadow-lg transition-all"
          >
            <div className="aspect-[1.414/1] bg-gray-100 relative overflow-hidden">
              <img 
                src={`http://localhost:8000/static/certificate_templates/${template}`} 
                alt={template}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <ImageIcon className="text-gray-400 flex-shrink-0" size={18} />
                <span className="font-medium text-sm text-gray-700 truncate">{template}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CertificateConfigurator;
