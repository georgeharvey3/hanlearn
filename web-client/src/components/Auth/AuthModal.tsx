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
import { emailSchema, passwordSchema, registerPasswordSchema } from '../../validation/schemas';

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
  resetEmailSent: state.auth.resetEmailSent,
});

const mapDispatchToProps = {
  onClose: actions.closeAuthModal,
  onGoogleSignIn: actions.googleSignIn,
  onEmailLogin: actions.auth,
  onEmailRegister: actions.register,
  onSwitchMode: actions.setAuthModalMode,
  onSendPasswordReset: actions.sendPasswordReset,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = ConnectedProps<typeof connector>;

const AuthModal: React.FC<Props> = ({
  open,
  mode,
  loading,
  error,
  resetEmailSent,
  onClose,
  onGoogleSignIn,
  onEmailLogin,
  onEmailRegister,
  onSwitchMode,
  onSendPasswordReset,
}) => {
  const [form, setForm] = useState(initialFormState());

  // Reset form when mode changes or modal opens/closes
  useEffect(() => {
    setForm(initialFormState());
  }, [mode, open]);

  const validateEmail = (value: string): string => {
    const result = emailSchema.safeParse(value);
    if (!result.success) return result.error.issues[0].message;
    return '';
  };

  const validatePassword = (value: string): string => {
    const schema = mode === 'register' ? registerPasswordSchema : passwordSchema;
    const result = schema.safeParse(value);
    if (!result.success) return result.error.issues[0].message;
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
    if (mode === 'forgot-password') {
      onSendPasswordReset(form.email.value);
    } else if (mode === 'login') {
      onEmailLogin(form.email.value, form.password.value);
    } else {
      onEmailRegister(form.email.value, form.password.value);
    }
  };

  const isFormValid = form.email.valid && (mode === 'forgot-password' || form.password.valid);

  const getHeading = () => {
    switch (mode) {
      case 'forgot-password':
        return 'Reset Password';
      case 'register':
        return 'Create Account';
      default:
        return 'Welcome Back';
    }
  };

  const getSubheading = () => {
    switch (mode) {
      case 'forgot-password':
        return "Enter your email and we'll send you a reset link";
      case 'register':
        return 'Start mastering Mandarin today';
      default:
        return 'Log in to continue your learning journey';
    }
  };

  const getSubmitLabel = () => {
    switch (mode) {
      case 'forgot-password':
        return 'Send Reset Link';
      case 'register':
        return 'Sign Up';
      default:
        return 'Log In';
    }
  };

  // Show confirmation after reset email is sent
  if (mode === 'forgot-password' && resetEmailSent) {
    return (
      <Modal show={open} modalClosed={onClose}>
        <Box sx={{ textAlign: 'center', py: 2, px: 1 }}>
          <Typography variant="h5" sx={{ color: 'text.primary', mb: 1, fontWeight: 600 }}>
            Check Your Email
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            If an account exists with that email, we&apos;ve sent a password reset link.
          </Typography>
          <Button
            variant="contained"
            onClick={() => onSwitchMode('login')}
            fullWidth
            disableElevation
            sx={{
              py: 1.3,
              bgcolor: '#1a5c40',
              color: 'common.white',
              fontWeight: 600,
              fontSize: '0.95rem',
              borderRadius: 1.5,
              '&:hover': { bgcolor: '#144a33' },
            }}
          >
            Back to Log In
          </Button>
        </Box>
      </Modal>
    );
  }

  return (
    <Modal show={open} modalClosed={onClose}>
      <Box sx={{ textAlign: 'center', py: 2, px: 1 }}>
        <Typography variant="h5" sx={{ color: 'text.primary', mb: 1, fontWeight: 600 }}>
          {getHeading()}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          {getSubheading()}
        </Typography>

        {error && (
          <Typography role="alert" sx={{ color: 'error.main', mb: 2, fontSize: '0.875rem' }}>{error}</Typography>
        )}

        {mode !== 'forgot-password' && (
          <>
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

            <Box aria-hidden="true" sx={{ display: 'flex', alignItems: 'center', my: 2.5 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              <Typography sx={{ px: 2, color: 'text.secondary', fontSize: '0.8rem' }}>
                or
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
            </Box>
          </>
        )}

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

            {mode !== 'forgot-password' && (
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
            )}

            {mode === 'login' && (
              <Box sx={{ textAlign: 'right', mt: 0.5 }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => onSwitchMode('forgot-password')}
                  sx={{
                    color: '#1a5c40',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    fontSize: '0.8rem',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  Forgot password?
                </Box>
              </Box>
            )}

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
              {getSubmitLabel()}
            </Button>
          </form>
        )}

        <Box sx={{ mt: 3 }}>
          {mode === 'forgot-password' ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <Box
                component="button"
                onClick={() => onSwitchMode('login')}
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
                Back to Log In
              </Box>
            </Typography>
          ) : (
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
          )}
        </Box>
      </Box>
    </Modal>
  );
};

export default connector(AuthModal);
