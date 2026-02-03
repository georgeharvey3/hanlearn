import React, { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Redirect } from 'react-router-dom';

import classes from './Auth.module.css';

import FormInput from '../../components/UI/FormInput/FormInput';
import Button from '../../components/UI/Buttons/Button/Button';
import Spinner from '../../components/UI/Spinner/Spinner';
import * as actions from '../../store/actions/index';
import { RootState } from '../../types/store';

interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  isEmail?: boolean;
  isNumeric?: boolean;
}

interface FormControl {
  elementType: string;
  elementConfig: {
    type: string;
    placeholder: string;
  };
  value: string;
  validation: ValidationRules | null;
  valid: boolean;
  touched: boolean;
}

interface RegisterState {
  controls: {
    email: FormControl;
    username: FormControl;
    password: FormControl;
    [key: string]: FormControl;
  };
  formIsValid: boolean;
}

const mapStateToProps = (state: RootState) => ({
  loading: state.auth.loading,
  error: state.auth.error,
  isAuthenticated: state.auth.userId !== null,
  newSignUp: state.auth.newSignUp,
});

const mapDispatchToProps = {
  onRegister: actions.register,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

const Register: React.FC<PropsFromRedux> = ({
  loading,
  error,
  isAuthenticated,
  newSignUp,
  onRegister,
}) => {
  const [state, setState] = useState<RegisterState>({
    controls: {
      email: {
        elementType: 'input',
        elementConfig: {
          type: 'email',
          placeholder: 'Email Address',
        },
        value: '',
        validation: {
          required: true,
          isEmail: true,
        },
        valid: false,
        touched: false,
      },
      username: {
        elementType: 'input',
        elementConfig: {
          type: 'text',
          placeholder: 'Username',
        },
        value: '',
        validation: {
          required: true,
          minLength: 5,
        },
        valid: false,
        touched: false,
      },
      password: {
        elementType: 'input',
        elementConfig: {
          type: 'password',
          placeholder: 'Password',
        },
        value: '',
        validation: {
          required: true,
          minLength: 6,
        },
        valid: false,
        touched: false,
      },
    },
    formIsValid: false,
  });

  const checkValidity = (value: string, rules: ValidationRules | null): boolean => {
    let isValid = true;
    if (!rules) {
      return true;
    }

    if (rules.required) {
      isValid = value.trim() !== '' && isValid;
    }

    if (rules.minLength) {
      isValid = value.length >= rules.minLength && isValid;
    }

    if (rules.maxLength) {
      isValid = value.length <= rules.maxLength && isValid;
    }
    if (rules.isEmail) {
      // eslint-disable-next-line no-useless-escape
      const pattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      isValid = pattern.test(value) && isValid;
    }

    if (rules.isNumeric) {
      const pattern = /^\d+$/;
      isValid = pattern.test(value) && isValid;
    }

    return isValid;
  };

  const inputChangedHandler = (event: ChangeEvent<HTMLInputElement>, controlName: string): void => {
    const value = event.target.value;
    setState((prevState) => {
      const updatedControlsForm = {
        ...prevState.controls,
        [controlName]: {
          ...prevState.controls[controlName],
          value: value,
          valid: checkValidity(
            value,
            prevState.controls[controlName].validation
          ),
          touched: true,
        },
      };

      let formIsValid = false;
      for (const inputIdentifier in updatedControlsForm) {
        formIsValid = updatedControlsForm[inputIdentifier].valid;
        if (!formIsValid) {
          break;
        }
      }

      return {
        controls: updatedControlsForm,
        formIsValid: formIsValid,
      };
    });
  };

  const submitHandler = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onRegister(
      state.controls.email.value,
      state.controls.username.value,
      state.controls.password.value
    );
  };

  const formElementsArray = useMemo(() => {
    const elements: { id: string; config: FormControl }[] = [];
    for (const key in state.controls) {
      elements.push({
        id: key,
        config: state.controls[key],
      });
    }
    return elements;
  }, [state.controls]);

  const formElements = formElementsArray.map((formElement) => {
    return (
      <FormInput
        key={formElement.id}
        elementType={formElement.config.elementType}
        elementConfig={formElement.config.elementConfig}
        value={formElement.config.value}
        invalid={!formElement.config.valid}
        shouldValidate={formElement.config.validation}
        touched={formElement.config.touched}
        changed={(event: ChangeEvent<HTMLInputElement>) =>
          inputChangedHandler(event, formElement.id)
        }
      />
    );
  });

  let form: React.ReactNode = (
    <form onSubmit={submitHandler}>
      {formElements}
      <br />
      <Button disabled={!state.formIsValid}>Register</Button>
    </form>
  );

  if (loading) {
    form = <Spinner />;
  }

  let errorMessage: React.ReactNode = null;

  if (error) {
    errorMessage = <p>{error}</p>;
  }

  let authRedirect: React.ReactNode = null;

  if (isAuthenticated) {
    authRedirect = <Redirect to="/" />;
  } else if (newSignUp) {
    authRedirect = <Redirect to="/auth" />;
  }

  return (
    <div className={classes.Auth}>
      <h1>Sign Up</h1>
      {authRedirect}
      {errorMessage}
      {form}
    </div>
  );
};

export default connector(Register);
