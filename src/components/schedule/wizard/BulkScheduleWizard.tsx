/**
 * Thin shell preserved for backwards compatibility.
 * The multi-step wizard has been replaced by the unified BulkScheduleGenerator.
 */
import BulkScheduleGenerator from "@/components/schedule/BulkScheduleGenerator";

export interface WizardData {
  // Kept as a loose alias so any lingering type imports don't break.
  [key: string]: unknown;
}

interface BulkScheduleWizardProps {
  onScheduleGenerated?: () => void;
  onCancel?: () => void;
}

export const BulkScheduleWizard = ({ onScheduleGenerated }: BulkScheduleWizardProps) => {
  return <BulkScheduleGenerator onScheduleGenerated={onScheduleGenerated} />;
};

export default BulkScheduleWizard;
