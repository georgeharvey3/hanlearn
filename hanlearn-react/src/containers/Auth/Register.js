import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';

import classes from './Auth.module.css';

import FormInput from '../../components/UI/FormInput/FormInput';
import Button from '../../components/UI/Buttons/Button/Button';
import Spinner from '../../components/UI/Spinner/Spinner';
import * as actions from '../../store/actions/index';

class Auth extends Component {
    state = {
        controls: {
            email: {
                elementType: 'input',
                elementConfig: {
                    type: 'email',
                    placeholder: 'Email Address'
                },
                value: '',
                validation: {
                    required: true,
                    isEmail: true
                },
                valid: false,
                touched: false
            },
            username: {
                elementType: 'input',
                elementConfig: {
                    type: 'text',
                    placeholder: 'Username'
                },
                value: '',
                validation: {
                    required: true,
                    minLength: 5
                },
                valid: false,
                touched: false
            },
            password: {
                elementType: 'input',
                elementConfig: {
                    type: 'password',
                    placeholder: 'Password'
                },
                value: '',
                validation: {
                    required: true,
                    minLength: 6
                },
                valid: false,
                touched: false
            }
        },
        formIsValid: false
    }

    checkValidity = (value, rules) => {
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
            /* eslint-disable */
            const pattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
            /* eslint-enable */
            isValid = pattern.test(value) && isValid
        }

        if (rules.isNumeric) {
            const pattern = /^\d+$/;
            isValid = pattern.test(value) && isValid
        }

        return isValid;
    }

    inputChangedHandler = (event, controlName) => {
        const updatedControlsForm = {
            ...this.state.controls,
            [controlName]: {
                ...this.state.controls[controlName],
                value: event.target.value,
                valid: this.checkValidity(event.target.value, this.state.controls[controlName].validation),
                touched: true
            }
        };

        let formIsValid = false;
        for (let inputIdentifier in updatedControlsForm) {
            formIsValid = updatedControlsForm[inputIdentifier].valid;
            if (!formIsValid) {
                break;
            }
        }

        this.setState({
            controls: updatedControlsForm,
            formIsValid: formIsValid
        })

    }

    submitHandler = event => {
        event.preventDefault();
        this.props.onRegister(this.state.controls.email.value, this.state.controls.username, this.state.controls.password.value)
    }

    render () {
        const formElementsArray = [];
        for (let key in this.state.controls) {
            formElementsArray.push({
                id: key,
                config: this.state.controls[key]
            });
        }
        
        const formElements = formElementsArray.map(formElement => {
            return (
                <FormInput
                    key={formElement.id}
                    elementType={formElement.config.elementType}
                    elementConfig={formElement.config.elementConfig}
                    value={formElement.config.value}
                    invalid={!formElement.config.valid}
                    shouldValidate={formElement.config.validation}
                    touched={formElement.config.touched}
                    changed={(event) => this.inputChangedHandler(event, formElement.id)} />
            )
        });

        let form = (
            <form onSubmit={this.submitHandler}>
                {formElements}
                <br/>
                <Button 
                    disabled={!this.state.formIsValid}>Register</Button>
            </form>
        )

        if (this.props.loading) {
            form = <Spinner />
        }

        let errorMessage = null;
        
        if (this.props.error) {
            errorMessage = <p>{this.props.error.message}</p>
        }

        let authRedirect = null;

        if (this.props.isAuthenticated) {
            authRedirect = <Redirect to="/" />;
        } else if (this.props.newSignUp) {
            authRedirect = <Redirect to="/auth" />;
        }
    

        return (
            <div className={classes.Auth}>
                <h1>Sign Up</h1>
                {authRedirect}
                {errorMessage}
                {form}
            </div>
        )
    }
}

const mapStateToProps = state => {
    return {
        loading: state.auth.loading,
        error: state.auth.error,
        isAuthenticated: state.auth.token !== null,
        newSignUp: state.auth.newSignUp
    }
}

const mapDispatchToProps = dispatch => {
    return {
        onRegister: (email, username, password) => dispatch(actions.register(email, username, password))
    }
}


export default connect(mapStateToProps, mapDispatchToProps)(Auth);
