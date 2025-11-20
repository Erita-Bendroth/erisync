import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  Calendar, 
  MapPin, 
  Globe,
  Loader2,
  AlertCircle,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { WizardData } from './HolidayImportWizard';

interface ReviewImportStepProps {
  wizardData: WizardData;
  onComplete: () => void;
  onBack: () => void;
}

export const ReviewImportStep: React.FC<ReviewImportStepProps> = ({
  wizardData,
  onComplete,
  onBack,
}) => {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [importedCount, setImportedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const handleImport = async () => {
    setIsImporting(true);
    setImportStatus('importing');
    setProgress(0);

    try {
      const regionsToImport = wizardData.hasRegions && wizardData.regions.length > 0
        ? wizardData.regions
        : [null];

      let totalImported = 0;
      const totalRegions = regionsToImport.length;

      for (let i = 0; i < regionsToImport.length; i++) {
        const region = regionsToImport[i];
        
        setProgress(((i + 1) / totalRegions) * 100);

        const { data, error } = await supabase.functions.invoke('import-holidays', {
          body: {
            country_code: wizardData.country,
            year: wizardData.year,
            user_id: null,
            region_code: region
          }
        });

        if (error) throw error;
        
        totalImported += data.imported || 0;
      }

      setImportedCount(totalImported);
      setImportStatus('success');
      
      toast({
        title: "Import successful!",
        description: `Imported ${totalImported} holidays for ${wizardData.countryName} ${wizardData.year}`,
      });

      setTimeout(() => {
        onComplete();
      }, 2000);

    } catch (error: any) {
      console.error('Import error:', error);
      setImportStatus('error');
      setErrorMessage(error.message || 'Failed to import holidays');
      
      toast({
        title: "Import failed",
        description: error.message || "Failed to import holidays",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (importStatus === 'importing') {
    return (
      <div className="space-y-6 py-8">
        <div className="text-center">
          <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary mb-4" />
          <h3 className="text-lg font-semibold">Importing holidays...</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This may take a few moments
          </p>
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-center text-muted-foreground">
            {Math.round(progress)}% complete
          </p>
        </div>
      </div>
    );
  }

  if (importStatus === 'success') {
    return (
      <div className="space-y-6 py-8 text-center">
        <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
        <div>
          <h3 className="text-lg font-semibold">Import successful!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Successfully imported {importedCount} holidays
          </p>
        </div>
      </div>
    );
  }

  if (importStatus === 'error') {
    return (
      <div className="space-y-6 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errorMessage}
          </AlertDescription>
        </Alert>

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={onBack}>
            Go Back
          </Button>
          <Button onClick={handleImport}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Download className="h-12 w-12 mx-auto text-primary mb-3" />
        <h3 className="text-lg font-semibold">Review & Import</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Please review your selections before importing
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Country</p>
              <p className="text-sm text-muted-foreground">{wizardData.countryName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Year</p>
              <p className="text-sm text-muted-foreground">{wizardData.year}</p>
            </div>
          </div>

          {wizardData.hasRegions && wizardData.regions.length > 0 && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">Regions</p>
                <div className="flex flex-wrap gap-2">
                  {wizardData.regions.map((region) => (
                    <Badge key={region} variant="secondary">
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Holidays will be imported as public holidays and automatically displayed
          to users based on their location settings.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
          Back
        </Button>
        <Button onClick={handleImport} disabled={isImporting}>
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Import Holidays
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
