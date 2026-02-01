import React, { Component } from 'react';

import classes from './Chengyu.module.css';

import Aux from '../../../hoc/Aux';

class Chengyu extends Component {

    state = {
        finished: false,
        incorrect: [],
        chengyu: "",
        options: [],
        correct: "",
        components: []
    }

    componentDidMount = () => {
        fetch('/api/get-chengyu')
        .then(response =>
            response.json().then(data => {
                this.setState({
                    chengyu: data.chengyu,
                    options: data.options,
                    correct: data.correct,
                    components: data.char_results
                });
            })
        .catch(error => {
            console.log(error);
        }))
    }

    optionClicked = (event, index) => {
        if (this.state.options[index] !== this.state.correct) {
            this.setState(prevState => {
                return {
                    incorrect: prevState.incorrect.concat(index)
                }
            });
        } else {
            this.setState({
                finished: true
            })
        }
    }

    render () {
        let components = null;

        if (this.state.finished) {
            components = <ul style={{margin: "0px"}}>
                            {this.state.components.map((c, index) => {
                                let trad = "";
                                let differentTrads = []

                                for (let i = 0; i < c.trads.length; i ++) {
                                    if (c.trads[i] !== c.char) {
                                        differentTrads.push(c.trads[i]);
                                    }
                                }

                                if (differentTrads.length > 0) {
                                    trad = " (" + differentTrads.join("/") + ")";
                                }

                                return (
                                    <Aux key={index}>
                                        <li style={{
                                            maxHeight: "1000px",
                                            opacity: 1,
                                            backgroundColor: "transparent",
                                            color: "#AA381E"}}>
                                            <h5 style={{
                                                fontSize: "1.5em", 
                                                margin: "3px auto",
                                                fontWeight: 'normal'}}>{c.char}{trad}</h5> ({c.pinyins.join("/")}): {c.meanings.join(", ")}
                                        </li>
                                        <br />
                                    </Aux>
                                );
                            })}
                        </ul>
        }
        return (
            <div className={classes.Chengyu}>
                <h3>Chengyu Of The Day</h3>
                <h2>{this.state.chengyu}</h2>
                <p>Choose the correct translation:</p>
                <ul>
                    {this.state.options.map((op, index) => {
                        let classNames = [classes.show];

                        if (this.state.finished) {
                            if (op !== this.state.correct) {
                                classNames = [];
                            } else {
                                classNames = [classes.show, classes.Correct];
                            }
                        }

                        if (this.state.incorrect.includes(index)) {
                            classNames.push(classes.Incorrect);
                        }

                        return (
                            <li 
                                className={classNames.join(" ")}
                                key={index} 
                                onClick={(event) => this.optionClicked(event, index)}>{op}
                            </li>
                        );
                    })}
                </ul>
                {components}
            </div>
        )
    }
}

export default Chengyu;