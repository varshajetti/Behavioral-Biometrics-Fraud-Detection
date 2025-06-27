import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function DemoDataGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const initializeDemoAccounts = useMutation(api.demo.initializeDemoAccounts);

  const generateDemoData = async () => {
    setIsGenerating(true);
    
    try {
      const result = await initializeDemoAccounts({});
      alert(result.message);
    } catch (error) {
      alert('Error generating demo data: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-medium text-blue-900 mb-2">Demo Mode</h3>
      <p className="text-blue-700 mb-4">
        This is a demonstration of behavioral biometrics for fraud detection. 
        The system tracks your typing patterns, mouse movements, and navigation behavior 
        to detect potential fraud in real-time.
      </p>
      <button
        onClick={generateDemoData}
        disabled={isGenerating}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isGenerating ? 'Creating Accounts...' : 'Create Demo Bank Accounts'}
      </button>
    </div>
  );
}
