import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  TextField,
} from '@material-ui/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validatePassword, sanitizeInput } from '@/lib/validation';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const token = searchParams.get('access_token');

  useEffect(() => {
    if (token) {
      setTokenValid(true);
    } else {
      toast({
        title: 'Invalid link',
        description: 'Missing recovery token',
        variant: 'destructive',
      });
      navigate('/login');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    const { isValid, errors } = validatePassword(form.newPassword);
    if (!isValid) {
      toast({
        title: 'Invalid password',
        description: errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const sanitized = sanitizeInput(form.newPassword);
      const { error } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token: token!,
        password: sanitized,
      });

      if (error) throw error;

      toast({
        title: 'Password updated',
        description: 'You can now log in with your new password.',
      });
      navigate('/login');
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update password',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ maxWidth: 400, margin: '0 auto', marginTop: '2rem' }}>
      <CardHeader
        title={<Typography variant="h6">Set New Password</Typography>}
        subheader={
          <Typography variant="body2">
            Enter and confirm your new password
          </Typography>
        }
      />
      <CardContent>
        {tokenValid ? (
          <form onSubmit={handleSubmit}>
            <TextField
              label="New Password"
              type="password"
              fullWidth
              margin="normal"
              value={form.newPassword}
              onChange={(e) =>
                setForm({ ...form, newPassword: e.target.value })
              }
              required
            />
            <TextField
              label="Confirm Password"
              type="password"
              fullWidth
              margin="normal"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              required
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
              style={{ marginTop: '1rem' }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        ) : (
          <Typography color="error" align="center">
            Invalid or expired reset link.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default ResetPassword;
