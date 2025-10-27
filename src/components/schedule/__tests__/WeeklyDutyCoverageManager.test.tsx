import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WeeklyDutyCoverageManager } from '../WeeklyDutyCoverageManager';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('WeeklyDutyCoverageManager', () => {
  const mockTeams = [
    { id: 'team-1', name: 'Team A' },
    { id: 'team-2', name: 'Team B' },
  ];

  const mockTemplate = {
    id: 'template-1',
    template_name: 'Test Template',
    team_ids: ['team-1'],
    distribution_list: ['test@example.com'],
    include_weekend_duty: true,
    include_lateshift: false,
    include_earlyshift: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock teams fetch
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: mockTeams, error: null }),
          }),
        };
      }
      if (table === 'weekly_duty_templates') {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: [mockTemplate], error: null }),
            eq: () => ({
              single: () => Promise.resolve({ data: mockTemplate, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    });
  });

  describe('Button Interaction Tests', () => {
    it('should render Preview Email button', async () => {
      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      await waitFor(() => {
        expect(screen.getByText('Preview Email')).toBeInTheDocument();
      });
    });

    it('should disable Preview button when no template selected', async () => {
      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      await waitFor(() => {
        const previewButton = screen.getByText('Preview Email').closest('button');
        expect(previewButton).toBeDisabled();
      });
    });

    it('should enable Preview button when template is selected', async () => {
      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument();
      });

      // Select template
      const select = screen.getByRole('combobox');
      fireEvent.click(select);
      fireEvent.click(screen.getByText('Test Template'));

      // Navigate to Preview & Send tab
      fireEvent.click(screen.getByText('Preview & Send'));

      await waitFor(() => {
        const previewButton = screen.getByText('Preview Email').closest('button');
        expect(previewButton).not.toBeDisabled();
      });
    });

    it('should call handlePreview when Preview button clicked', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { html: '<html><body>Preview</body></html>' },
        error: null,
      });
      (supabase.functions.invoke as any) = mockInvoke;

      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      // Wait and select template
      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      fireEvent.click(select);
      fireEvent.click(screen.getByText('Test Template'));

      // Navigate to Preview & Send tab
      fireEvent.click(screen.getByText('Preview & Send'));

      // Click Preview button
      const previewButton = screen.getByText('Preview Email').closest('button');
      fireEvent.click(previewButton!);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('send-weekly-duty-coverage', {
          body: expect.objectContaining({
            template_id: 'template-1',
            preview: true,
          }),
        });
      });
    });
  });

  describe('Dialog Rendering Tests', () => {
    it('should open preview dialog when preview succeeds', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { html: '<html><body>Test Preview Content</body></html>' },
        error: null,
      });
      (supabase.functions.invoke as any) = mockInvoke;

      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      // Select template and trigger preview
      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      fireEvent.click(select);
      fireEvent.click(screen.getByText('Test Template'));
      fireEvent.click(screen.getByText('Preview & Send'));

      const previewButton = screen.getByText('Preview Email').closest('button');
      fireEvent.click(previewButton!);

      // Check that preview dialog appears
      await waitFor(() => {
        expect(screen.getByText('Email Preview - Weekly Duty Coverage')).toBeInTheDocument();
      });
    });

    it('should display preview HTML content in dialog', async () => {
      const testHtml = '<div class="test-content">Custom Preview Content</div>';
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { html: testHtml },
        error: null,
      });
      (supabase.functions.invoke as any) = mockInvoke;

      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      fireEvent.click(select);
      fireEvent.click(screen.getByText('Test Template'));
      fireEvent.click(screen.getByText('Preview & Send'));

      const previewButton = screen.getByText('Preview Email').closest('button');
      fireEvent.click(previewButton!);

      await waitFor(() => {
        expect(screen.getByText('Custom Preview Content')).toBeInTheDocument();
      });
    });

    it('should close preview dialog when close button clicked', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { html: '<html><body>Test</body></html>' },
        error: null,
      });
      (supabase.functions.invoke as any) = mockInvoke;

      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      fireEvent.click(select);
      fireEvent.click(screen.getByText('Test Template'));
      fireEvent.click(screen.getByText('Preview & Send'));

      const previewButton = screen.getByText('Preview Email').closest('button');
      fireEvent.click(previewButton!);

      await waitFor(() => {
        expect(screen.getByText('Close Preview')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close Preview'));

      await waitFor(() => {
        expect(screen.queryByText('Email Preview - Weekly Duty Coverage')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Tests', () => {
    it('should show error toast when preview fails', async () => {
      const mockToast = vi.fn();
      
      const mockInvoke = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });
      (supabase.functions.invoke as any) = mockInvoke;

      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      fireEvent.click(select);
      fireEvent.click(screen.getByText('Test Template'));
      fireEvent.click(screen.getByText('Preview & Send'));

      const previewButton = screen.getByText('Preview Email').closest('button');
      fireEvent.click(previewButton!);

      await waitFor(() => {
        expect(screen.getByText(/Failed to generate preview/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show error when no template selected', async () => {
      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      await waitFor(() => {
        expect(screen.getByText('Preview & Send')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Preview & Send'));

      const previewButton = screen.getByText('Preview Email').closest('button');
      expect(previewButton).toBeDisabled();
    });
  });

  describe('Data Loading Tests', () => {
    it('should load template data when selected', async () => {
      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      fireEvent.click(select);
      fireEvent.click(screen.getByText('Test Template'));

      await waitFor(() => {
        const templateNameInput = screen.getByPlaceholderText('e.g., Troubleshooters Combined') as HTMLInputElement;
        expect(templateNameInput.value).toBe('Test Template');
      });
    });

    it('should persist selectedTemplate state after loading', async () => {
      render(<WeeklyDutyCoverageManager open={true} onOpenChange={vi.fn()} />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      fireEvent.click(select);
      fireEvent.click(screen.getByText('Test Template'));

      // Switch tabs to trigger re-render
      fireEvent.click(screen.getByText('Duty Assignments'));
      fireEvent.click(screen.getByText('Preview & Send'));

      // Button should still be enabled
      await waitFor(() => {
        const previewButton = screen.getByText('Preview Email').closest('button');
        expect(previewButton).not.toBeDisabled();
      });
    });
  });
});
