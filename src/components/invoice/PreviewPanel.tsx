interface PreviewPanelProps {
  data: { nickname: string; clientName: string; amount: string; description: string };
}

export default function PreviewPanel({ data }: PreviewPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-2xl aspect-[1/1.41] overflow-hidden flex items-center justify-center relative group text-gray-800">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="text-white font-bold tracking-widest uppercase text-sm">Live Preview</span>
      </div>
      
      <div className="w-full h-full p-12 flex flex-col">
        <div className="flex justify-between items-start mb-12">
          <h2 className="text-3xl font-serif font-bold text-gray-900">INVOICE</h2>
          <div className="text-right">
            <p className="font-bold">{data.clientName || 'Client Name'}</p>
            <p className="text-sm text-gray-500">Billed to</p>
          </div>
        </div>

        <div className="space-y-4 mb-12">
          <p className="text-gray-600 text-sm whitespace-pre-wrap min-h-[4rem]">
            {data.description || 'Description of services provided...'}
          </p>
        </div>
        
        <div className="mt-auto border-t border-gray-200 pt-8 flex justify-between items-end">
          <div className="text-gray-500 text-sm">
            <p>Due Date: {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-1">Total Amount</p>
            <p className="text-4xl font-bold text-gray-900">${data.amount || '0.00'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
