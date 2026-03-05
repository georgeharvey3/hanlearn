import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import GoogleIcon from '@mui/icons-material/Google';
import { connect, ConnectedProps } from 'react-redux';

import Modal from '../UI/Modal/Modal';
import FormInput from '../UI/FormInput/FormInput';
import Spinner from '../UI/Spinner/Spinner';
import { RootState } from '../../types/store';
import * as actions from '../../store/actions/index';

interface FormField {
  value: string;
  valid: boolean;
  touched: boolean;
  errorMessage: string;
}

const initialFormState = (): { email: FormField; password: FormField } => ({
  email: { value: '', valid: false, touched: false, errorMessage: '' },
  password: { value: '', valid: false, touched: false, errorMessage: '' },
});

const mapStateToProps = (state: RootState) => ({
  open: state.auth.modalOpen,
  mode: state.auth.modalMode,
  loading: state.auth.loading,
  error: state.auth.error,
});

const mapDispatchToProps = {
  onClose: actions.closeAuthModal,
  onGoogleSignIn: actions.googleSignIn,
  onEmailLogin: actions.auth,
  onEmailRegister: actions.register,
  onSwitchMode: actions.setAuthModalMode,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = ConnectedProps<typeof connector>;

const AuthModal: React.FC<Props> = ({
  open,
  mode,
  loading,
  error,
  onClose,
  onGoogleSignIn,
  onEmailLogin,
  onEmailRegister,
  onSwitchMode,
}) => {
  const [form, setForm] = useState(initialFormState());

  // Reset form when mode changes or modal opens/closes
  useEffect(() => {
    setForm(initialFormState());
  }, [mode, open]);

  const validateEmail = (value: string): string => {
    if (!value) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email address';
    return '';
  };

  const validatePassword = (value: string): string => {
    if (!value) return 'Password is required';
    if (mode === 'register' && value.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  const handleChange =
    (field: 'email' | 'password') =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value;
      const errorMessage = field === 'email' ? validateEmail(value) : validatePassword(value);
      setForm((prev) => ({
        ...prev,
        [field]: { value, valid: !errorMessage, touched: true, errorMessage },
      }));
    };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      onEmailLogin(form.email.value, form.password.value);
    } else {
      onEmailRegister(form.email.value, form.password.value);
    }
  };

  const isFormValid = form.email.valid && form.password.valid;

  return (
    <Modal show={open} modalClosed={onClose}>
      <Box sx={{ textAlign: 'center', py: 2, px: 1 }}>
        <Typography variant="h5" sx={{ color: 'text.primary', mb: 1, fontWeight: 600 }}>
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          {mode === 'login'
            ? 'Log in to continue your learning journey'
            : 'Start mastering Mandarin today'}
        </Typography>

        {error && (
          <Typography sx={{ color: 'error.main', mb: 2, fontSize: '0.875rem' }}>{error}</Typography>
        )}

        <Button
          onClick={() => onGoogleSignIn()}
          disabled={loading}
          variant="outlined"
          startIcon={<GoogleIcon />}
          fullWidth
          sx={{
            color: 'text.primary',
            borderColor: '#dadce0',
            bgcolor: '#fff',
            fontWeight: 500,
            '&:hover': { borderColor: '#bbb', bgcolor: '#f8f9fa' },
            mb: 2,
            py: 1.2,
          }}
        >
          Continue with Google
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', my: 2.5 }}>
          <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
          <Typography sx={{ px: 2, color: 'text.secondary', fontSize: '0.8rem' }}>or</Typography>
          <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
        </Box>

        {loading ? (
          <Spinner />
        ) : (
          <form onSubmit={handleSubmit}>
            <FormInput
              elementType="input"
              elementConfig={{ type: 'email', placeholder: 'Email' }}
              label="Email"
              value={form.email.value}
              invalid={!form.email.valid}
              touched={form.email.touched}
              shouldValidate
              errorMessage={form.email.errorMessage}
              changed={handleChange('email')}
            />

            <FormInput
              elementType="input"
              elementConfig={{ type: 'password', placeholder: 'Password' }}
              label="Password"
              value={form.password.value}
              invalid={!form.password.valid}
              touched={form.password.touched}
              shouldValidate
              errorMessage={form.password.errorMessage}
              changed={handleChange('password')}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={!isFormValid || loading}
              fullWidth
              disableElevation
              sx={{
                mt: 1,
                py: 1.3,
                bgcolor: '#1a5c40',
                color: 'common.white',
                fontWeight: 600,
                fontSize: '0.95rem',
                borderRadius: 1.5,
                '&:hover': { bgcolor: '#144a33' },
                '&.Mui-disabled': { bgcolor: '#a8d5c2', color: 'common.white' },
              }}
            >
              {mode === 'login' ? 'Log In' : 'Sign Up'}
            </Button>
          </form>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <Box
              component="button"
              onClick={() => onSwitchMode(mode === 'login' ? 'register' : 'login')}
              sx={{
                color: '#1a5c40',
                cursor: 'pointer',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                fontSize: 'inherit',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {mode === 'login' ? 'Sign Up' : 'Log In'}
            </Box>
          </Typography>
        </Box>
      </Box>
    </Modal>
  );
};

export default connector(AuthModal);
