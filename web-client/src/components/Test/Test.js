import React, { Component } from "react";
import { withRouter } from "react-router-dom";
import { connect } from "react-redux";
import { Howl } from "howler";

import classes from "./Test.module.css";

import * as testLogic from "./Logic/TestLogic";
import Aux from "../../hoc/Aux";
import Modal from "../UI/Modal/Modal";
import Backdrop from "../UI/Backdrop/Backdrop";
import ProgressBar from "./ProgressBar/ProgressBar";
import Input from "../UI/Input/Input";
import TestSummary from "./TestSummary/TestSummary";
import PictureButton from "../UI/Buttons/PictureButton/PictureButton";
import Button from "../UI/Buttons/Button/Button";
import Toggle from "../UI/Toggle/Toggle";
import Spinner from "../UI/Spinner/Spinner";

import micPic from "../../assets/images/microphone.png";
import speakerPic from "../../assets/images/speaker.png";
import likePic from "../../assets/images/like.png";
import dislikePic from "../../assets/images/dislike.png";

import successSound from "../../assets/sounds/success1.wav";
import failSound from "../../assets/sounds/failure1.wav";

let pinyinConverter = require("pinyin");

const beep = new Howl({
    src: [successSound],
    volume: 0.5,
});

const fail = new Howl({
    src: [failSound],
    volume: 0.7,
});

class Test extends Component {
    constructor() {
        super();
        let numWords = localStorage.getItem("numWords") || 5;
        let charSet = localStorage.getItem("charSet") || "simp";
        let priority = localStorage.getItem("priority") || "none";
        let onlyPriority =
            localStorage.getItem("onlyPriority") === "true" ? true : false;

        this.state = {
            testSet: [],
            permList: [],
            numWords: numWords,
            charSet: charSet,
            perm: null,
            answer: null,
            answerCategory: null,
            question: null,
            questionCategory: null,
            chosenCharacter: null,
            result: "",
            answerInput: "",
            idkDisabled: false,
            submitDisabled: false,
            progressBar: 0,
            initNumPerms: 0,
            idkList: [],
            scoreList: [],
            testFinished: false,
            showInput: false,
            showInputChars: [],
            drawnCharacters: [],
            numSpeakTries: 0,
            useSound: true,
            useHandwriting: true,
            useChineseSpeechRecognition: true,
            useEnglishSpeechRecognition: true,
            useAutoRecord: false,
            useFlashcards: false,
            showErrorMessage: false,
            redoChar: false,
            sentenceWords: [],
            writer: null,
            qNum: 0,
            recognition: null,
            showPinyin: false,
            showHint: false,
            listening: false,
            priority: priority,
            onlyPriority: onlyPriority,
            showQuestionPinyin: false,
            hintLoading: false,
            showAnswer: false,
            yesClicked: false,
            noClicked: false,
            pauseAutoRecord: false,
            synthLoading: false,
            speechLoading: false,
            interaction: false,
            speechResult: false
        };
    }

    componentDidMount() {
        this.initialiseSettings();

        document.addEventListener("keyup", this.onKeyUp);

        document.addEventListener("onMouseOver", this.setInteraction);
        document.addEventListener("onscroll", this.setInteraction);
        document.addEventListener("onkeydown", this.setInteraction);
    }
    componentWillUnmount = () => {
        document.removeEventListener("keyup", this.onKeyUp);

        document.removeEventListener("onMouseOver", this.setInteraction);
        document.removeEventListener("onscroll", this.setInteraction);
        document.removeEventListener("onkeydown", this.setInteraction);

        window.speechSynthesis.cancel();
    };

    componentDidUpdate = (_, prevState) => {
        if (prevState.qNum !== this.state.qNum) {
            window.speechSynthesis.cancel();
            this.setState({
                yesClicked: false,
                noClicked: false,
                showQuestionPinyin: false,
                pauseAutoRecord: false,
            });

            // auto speak pinyin question
            if (
                this.state.questionCategory === "pinyin" &&
                this.state.useSound
            ) {
                this.onSpeak(
                    this.state.chosenCharacter,
                    this.state.useAutoRecord
                );
            }

            // if autoRecord and pinyin question not going to be spoken
            if (
                this.state.useAutoRecord &&
                !(
                    this.state.questionCategory === "pinyin" &&
                    this.state.useSound
                )
            ) {
                if (this.state.answerCategory === "pinyin") {
                    this.onListen();
                }
                if (this.state.answerCategory === "meaning") {
                    if (!this.state.useFlashcards) {
                        this.onListen();
                    }
                }
            }
            if (this.state.answerCategory === "character") {
                this.setHanziWriter(this.state.answer);
            }
        }
    };

    setInteraction() {
        this.setState({
            interaction: true,
        });
    }

    initialiseSettings() {
        let useSound =
            this.props.synthAvailable &&
            (!(localStorage.getItem("useSound") === "false") ||
                Boolean(this.props.isDemo));
        let useHandwriting =
            !(localStorage.getItem("useHandwriting") === "false") ||
            Boolean(this.props.isDemo);

        let useChineseSpeechRecognition =
            this.props.speechAvailable &&
            (!(
                localStorage.getItem("useChineseSpeechRecognition") === "false"
            ) ||
                Boolean(this.props.isDemo));

        let useEnglishSpeechRecognition =
            this.props.speechAvailable &&
            (!(
                localStorage.getItem("useEnglishSpeechRecognition") === "false"
            ) ||
                Boolean(this.props.isDemo));

        let useFlashcards =
            (this.props.speechAvailable &&
                !(localStorage.getItem("useFlashcards") === "false")) ||
            Boolean(this.props.isDemo);

        this.setState({
            useSound: useSound,
            useHandwriting: useHandwriting,
            useChineseSpeechRecognition: useChineseSpeechRecognition,
            useEnglishSpeechRecognition: useEnglishSpeechRecognition,
            useFlashcards: useFlashcards,
        });

        this.onInitialiseTestSet(useHandwriting);
    }

    onKeyUp = (event) => {
        const sourceElement = event.target.tagName.toLowerCase();

        const micAvailable =
            ((this.state.useChineseSpeechRecognition &&
                this.state.answerCategory === "pinyin") ||
                (this.state.useEnglishSpeechRecognition &&
                    this.state.answerCategory === "meaning")) &&
            !this.state.listening &&
            !this.state.testFinished;

        const speakerAvailable =
            this.state.useSound &&
            this.state.questionCategory === "pinyin" &&
            !this.state.testFinished &&
            !this.state.listening;

        // ctrl + i
        if (event.ctrlKey && event.key === "i")
            if (!this.state.idkDisabled) {
                // trigger idk
                this.onIDontKnow();
            }

        // space
        if (event.key === " ") {
            // test finished
            if (this.state.testFinished) {
                event.preventDefault();
                if (
                    !this.props.finalStage &&
                    (this.state.sentenceWords.length > 0 || this.props.isDemo)
                ) {
                    this.props.startSentenceRead(this.state.sentenceWords);
                } else {
                    this.onHomeClicked();
                }
            }
            // outside input
            else if (sourceElement !== "input") {
                event.preventDefault();
                event.target.blur();
                // answerCategory is pinyin and useChineseSpeech or answerCategory is meaning or useEnglishSpeech
                if (micAvailable && this.state.answerCategory === "pinyin") {
                    // trigger microphone
                    this.onListen();
                    // else if useSound and questionCategory is pinyin
                } else if (
                    this.state.useFlashcards &&
                    this.state.answerCategory === "meaning"
                ) {
                    this.onShowAnswer();
                } else if (speakerAvailable) {
                    // trigger speaker
                    this.onSpeak(this.state.chosenCharacter);
                }
            }
        }

        // ctrl + m
        if (event.ctrlKey && event.key === "m") {
            if (micAvailable) {
                this.onListen();
            }
        }

        // ctrl + q
        if (event.ctrlKey && event.key === "q") {
            if (speakerAvailable) {
                this.onSpeak(this.state.chosenCharacter);
            }
        }

        // ctrl + b
        if (event.ctrlKey && event.key === "b") {
            if (document.getElementById("answer-input") !== null) {
                document.getElementById("answer-input").focus();
            } else if (document.getElementById("secondary-input")) {
                document.getElementById("secondary-input").focus();
            }
        }

        // up arrow
        if (event.key === "ArrowUp") {
            if (this.state.showAnswer && !this.state.idkDisabled) {
                this.setState({ yesClicked: true });
                this.onCorrectAnswer();
            }
        }

        // down arrow
        if (event.key === "ArrowDown") {
            if (this.state.showAnswer && !this.state.idkDisabled) {
                if (this.state.useSound) {
                    fail.play();
                }
                this.setState({ noClicked: true });
                this.onIDontKnow();
            }
        }

        // p
        if (event.key === "p") {
            if (sourceElement !== "input") {
                if (this.state.questionCategory === "pinyin") {
                    this.onToggleShowPinyin();
                }
            }
        }

        // a
        if (event.key === "a") {
            if (sourceElement !== "input") {
                if (this.state.useAutoRecord) {
                    this.state.recognition.abort();
                } else {
                    this.onListen();
                }
                this.setState((prevState) => ({
                    useAutoRecord: !prevState.useAutoRecord,
                }));
            }
        }

        // h
        if (event.key === "h") {
            if (sourceElement !== "input") {
                this.onHint();
            }
        }

        // s
        if (event.key === "s") {
            if (sourceElement !== "input") {
                if (speakerAvailable) {
                    this.onSpeak(this.state.chosenCharacter);
                }
            }
        }

        // i
        if (event.key === "i") {
            if (sourceElement !== "input") {
                if (!this.state.idkDisabled) {
                    this.onIDontKnow();
                }
            }
        }
    };

    onInitialiseTestSet = (useHandwriting) => {
        let permList = testLogic.setPermList(
            this.props.words,
            useHandwriting,
            this.state.priority,
            this.state.onlyPriority
        );
        let initialVals = testLogic.assignQA(
            this.props.words,
            permList,
            this.state.charSet,
            this.state.priority,
            this.state.onlyPriority
        );
        this.setState((prevState) => {
            return {
                testSet: this.props.words,
                permList: permList,
                perm: initialVals.perm,
                answer: initialVals.answer,
                answerCategory: initialVals.answerCategory,
                question: initialVals.question,
                questionCategory: initialVals.questionCategory,
                chosenCharacter: initialVals.chosenCharacter,
                initNumPerms: permList.length,
                showErrorMessage: false,
                qNum: prevState.qNum + 1,
            };
        });
    };

    setHanziWriter = (char) => {
        let index = 0;

        let flashChar = false;

        let numBeforeHint = 5;

        if (this.props.isDemo) {
            numBeforeHint = 1;
        }

        try {
            document.getElementById("character-target-div").innerHTML = "";
        } catch (e) {}

        let writer = window.HanziWriter.create(
            "character-target-div",
            char[index],
            {
                width: 150,
                height: 150,
                padding: 20,
                showOutline: false,
                showCharacter: flashChar,
                showHintAfterMisses: numBeforeHint,
                delayBetweenStrokes: 10,
                strokeAnimationSpeed: 1,
            }
        );

        this.setState({
            writer: writer,
        });

        this.quizWriter(writer, char, index);
    };

    updateHanziWriterQuiz = (writer, char, index) => {
        writer.setCharacter(char[index]);

        this.quizWriter(writer, char, index);
    };

    quizWriter = (writer, char, index) => {
        writer.quiz({
            onComplete: () => {
                index++;
                if (index < char.length) {
                    setTimeout(
                        function () {
                            this.updateHanziWriterQuiz(writer, char, index);
                        }.bind(this),
                        1000
                    );
                } else {
                    this.setState((prevState) => {
                        return {
                            drawnCharacters:
                                prevState.drawnCharacters.concat(char),
                        };
                    });
                    setTimeout(
                        function () {
                            try {
                                document.getElementById(
                                    "character-target-div"
                                ).innerHTML = "";
                            } catch (e) {}
                            this.onCorrectAnswer();
                        }.bind(this),
                        1000
                    );
                }
            },
        });
    };

    onIdkChar = (writer, char) => {
        this.setState({
            idkDisabled: true,
        });
        writer.cancelQuiz();
        let index = 0;
        writer.setCharacter(char[index]);
        this.animateWriter(writer, char, index);
    };

    updateHanziWriterAnimate = (writer, char, index) => {
        writer.setCharacter(char[index]);

        this.animateWriter(writer, char, index);
    };

    animateWriter = (writer, char, index) => {
        writer.animateCharacter({
            onComplete: () => {
                index++;
                if (index < char.length) {
                    this.updateHanziWriterAnimate(writer, char, index);
                } else {
                    try {
                        document.getElementById(
                            "character-target-div"
                        ).innerHTML = "";
                    } catch (e) {}
                    this.setState((prevState) => {
                        let idkChar =
                            prevState.testSet[prevState.perm.index][
                                this.state.charSet
                            ];
                        return {
                            idkList: prevState.idkList.concat(idkChar),
                        };
                    });

                    let newQuestion = testLogic.assignQA(
                        this.state.testSet,
                        this.state.permList,
                        this.state.charSet,
                        this.state.priority,
                        this.state.onlyPriority
                    );

                    let redoChar = false;

                    if (newQuestion.perm === this.state.perm) {
                        redoChar = true;
                    }

                    this.setState((prevState) => {
                        return {
                            perm: newQuestion.perm,
                            answer: newQuestion.answer,
                            answerCategory: newQuestion.answerCategory,
                            question: newQuestion.question,
                            questionCategory: newQuestion.questionCategory,
                            chosenCharacter: newQuestion.chosenCharacter,
                            idkDisabled: false,
                            result: "",
                            answerInput: "",
                            redoChar: redoChar,
                            qNum: prevState.qNum + 1,
                        };
                    });
                }
            },
        });
    };

    onKeyPress = (e) => {
        if (
            e.key !== "Enter" ||
            this.state.submitDisabled ||
            this.state.answerInput === ""
        ) {
            return;
        }
        this.onSubmitAnswer();
        this.setState({ answerInput: "" });
    };

    onInputChanged = (e) => {
        this.state.recognition && this.state.recognition.abort();
        this.setState({ answerInput: e.target.value, pauseAutoRecord: true });
    };

    onCorrectAnswer = (usedSpeech) => {
        let resultString = 'Correct';

        if (this.state.answerCategory === 'pinyin' && usedSpeech) {
            resultString = `"${this.state.answer}" is correct!`
        }
        
        this.setState({
            result: resultString,
            showInput: false,
            idkDisabled: true,
            submitDisabled: true,
        });
        if (this.state.useSound) {
            beep.play();
        }
        let permIndex = this.state.permList.indexOf(this.state.perm);
        const newPermList = this.state.permList.filter(
            (_, index) => index !== permIndex
        );

        if (permIndex !== -1) {
            this.setState({ permList: newPermList });
        }
        if (newPermList.length !== 0) {
            let newQuestion = testLogic.assignQA(
                this.state.testSet,
                newPermList,
                this.state.charSet,
                this.state.priority,
                this.state.onlyPriority
            );
            setTimeout(
                function () {
                    this.setState((prevState) => {
                        return {
                            perm: newQuestion.perm,
                            answer: newQuestion.answer,
                            answerCategory: newQuestion.answerCategory,
                            question: newQuestion.question,
                            questionCategory: newQuestion.questionCategory,
                            chosenCharacter: newQuestion.chosenCharacter,
                            result: "",
                            answerInput: "",
                            showInput: false,
                            numSpeakTries: 0,
                            qNum: prevState.qNum + 1,
                            idkDisabled: false,
                            submitDisabled: false,
                            showAnswer: false,
                        };
                    });
                }.bind(this),
                1000
            );
        } else {
            this.onFinishTest();
            this.setState({ result: "Finished!" });
        }
    };

    checkAnswer = (cleanInput) => {
        cleanInput = testLogic.removePunctuation(cleanInput.trim());

        if (this.state.answerCategory === "pinyin") {
            let cleanAnswer = testLogic.removePunctuation(this.state.answer);

            cleanInput = cleanInput.replace(" ", "");
            cleanInput = cleanInput.replace("5", "");
            cleanAnswer = cleanAnswer.replace(" ", "");
            cleanAnswer = cleanAnswer.replace("5", "");

            return cleanInput === cleanAnswer;
        } else {
            //answer category must be meaning

            let match = false;

            this.state.answer.forEach((meaning) => {
                let cleanAnswer = testLogic.removePunctuation(meaning);

                match = match || cleanInput === cleanAnswer;
            });

            return match;
        }
    };

    onSubmitAnswer = () => {
        if (this.checkAnswer(this.state.answerInput)) {
            console.log(1);
            this.onCorrectAnswer();
        } else {
            if (this.state.useSound) {
                fail.play();
            }
            let resultString = "Try again";

            if (this.state.answerCategory === "pinyin") {
                let cleanAnswer = this.state.answer
                    .replace(" ", "")
                    .toLowerCase();
                let cleanInput = this.state.answerInput
                    .trim()
                    .replace(" ", "")
                    .toLowerCase();

                if (testLogic.toneChecker(cleanInput, cleanAnswer)) {
                    resultString = "Incorrect tones";
                }
            }

            this.setState({ result: resultString, showHint: false });
            if (this.state.useAutoRecord && !this.state.pauseAutoRecord) {
                this.onListen();
            }
        }

        if (this.state.recognition !== null) {
            this.state.recognition.abort();
        }
    };

    submitSpeech = (speech) => {
        const numToPinMap = [
            "ling3",
            "yi1",
            "er4",
            "san1",
            "si4",
            "wu3",
            "liu4",
            "qi1",
            "ba1",
            "jiu3",
            "shi2",
        ];

        let submission;

        if (this.state.answerCategory === "pinyin") {
            let asPinyin = pinyinConverter(speech, {
                style: pinyinConverter.STYLE_TONE2,
            });

            submission = asPinyin.map((char) => {
                if (!isNaN(char)) {
                    return numToPinMap[Number(char)];
                } else {
                    return char;
                }
            });

            submission = submission.join(" ");
        } else {
            submission = speech;
        }

        if (
            speech === this.state.chosenCharacter ||
            (this.state.answerCategory === "meaning" &&
                this.state.answer.includes(speech))
        ) {
            console.log(2);
            this.onCorrectAnswer(true);
        } else if (submission === this.state.answer) {
            console.log(3);
            this.onCorrectAnswer(true);
        } else if (
            this.state.answerCategory === "pinyin" &&
            submission.replace(/[0-9]/g, "") ===
                this.state.answer.replace(/[0-9]/g, "")
        ) {
            if (this.state.useSound) {
                fail.play();
            }

            let sentence = "Try different tones...";
            if (this.state.chosenCharacter.length === 1) {
                sentence = "Try a different tone...";
            }

            if (this.state.numSpeakTries > -1) {
                this.setState({
                    result:
                        `We heard: '${submission}', which is wrong. ` +
                        sentence,
                    showInput: true,
                });
            } else {
                this.setState((prevState) => {
                    return {
                        result:
                            `We heard: '${submission}', which is wrong. ` +
                            sentence,
                        numSpeakTries: prevState.numSpeakTries + 1,
                    };
                });
            }
            if (this.state.useAutoRecord && !this.state.pauseAutoRecord) {
                setTimeout(this.onListen, 1500);
            }
        } else {
            if (this.state.useSound) {
                fail.play();
            }
            if (this.state.numSpeakTries > -1) {
                this.setState({
                    result: `We heard: '${submission}', which is wrong. Try again...`,
                    showInput: true,
                });
            } else {
                this.setState((prevState) => {
                    return {
                        result: `We heard: '${submission}', which is wrong. Try again...`,
                        numSpeakTries: prevState.numSpeakTries + 1,
                    };
                });
            }
            if (this.state.useAutoRecord && !this.state.pauseAutoRecord) {
                setTimeout(this.onListen, 1500);
            }
        }
    };

    onSpeak = (word, auto = false) => {
        if (this.state.recognition !== null) {
            this.state.recognition.abort();
        }

        if (this.state.interaction) {
            this.setState({
                synthLoading: true,
            });
        }

        let synth = window.speechSynthesis;
        let utterThis = new SpeechSynthesisUtterance(word);
        utterThis.lang = this.props.lang;
        utterThis.voice = this.props.voice;
        utterThis.onerror = (e) => {
            if (e.error === "synthesis-failed") {
                this.setState({
                    result: "Error playing pinyin",
                    showPinyin: true,
                });
            }
        };
        utterThis.onend = () => {
            if (
                auto &&
                !(
                    this.state.answerCategory === "character" ||
                    (this.state.answerCategory === "meaning" &&
                        this.state.useFlashcards)
                )
            ) {
                this.onListen();
            }
        };
        utterThis.onstart = () => {
            this.setState({
                synthLoading: false,
            });
        };
        synth.cancel();
        synth.speak(utterThis);
    };

    onListen = () => {
        window.speechSynthesis.cancel();
        if (this.state.recognition !== null) {
            this.state.recognition.abort();
        }

        let recognition = new window.webkitSpeechRecognition();

        if (this.state.answerCategory === "pinyin") {
            recognition.lang = "zh-CN";
        } else {
            recognition.lang = "en";
        }
        this.setState({
            recognition: recognition,
        });
        let result;

        recognition.addEventListener("result", (event) => {
            this.setState({ speechResult: true });
            result = event.results[0][0].transcript;
            this.submitSpeech(result.toLowerCase());
        });

        recognition.addEventListener("end", (event) => {
            this.setState({
                listening: false,
                speechLoading: false,
                speechResult: false
            });

            if (!result && !this.state.idkDisabled) {
                this.setState({
                    result: "Couldn't hear anything...",
                    showInput: true,
                });
            }
        });

        recognition.addEventListener("audioend", (event) => {
            if (!this.state.speechResult) {
                this.setState({
                    result: "",
                    speechLoading: true
                });
            } else {
                this.setState({
                    speechLoading: true,
                });
            }
        });

        recognition.addEventListener("audiostart", (event) => {
            this.setState({
                result: "Listening...",
                listening: true,
            });
        });

        recognition.start();
    };

    onIDontKnow = () => {
        if (this.state.recognition !== null) {
            this.state.recognition.abort();
        }
        window.speechSynthesis.cancel();

        let charDivExists =
            this.state.answerCategory === "character" &&
            this.state.useHandwriting;
        if (charDivExists) {
            this.onIdkChar(this.state.writer, this.state.answer);
            return;
        }

        let displayAnswer = this.state.answer;
        if (this.state.answerCategory === "meaning") {
            displayAnswer = displayAnswer.join(" / ");
        }

        this.setState((prevState) => {
            let idkChar =
                prevState.testSet[prevState.perm.index][this.state.charSet];
            return {
                idkList: prevState.idkList.concat(idkChar),
                idkDisabled: true,
                submitDisabled: true,
                result: `Answer was: '${displayAnswer}'`,
            };
        });

        let newQuestion = testLogic.assignQA(
            this.state.testSet,
            this.state.permList,
            this.state.charSet,
            this.state.priority,
            this.state.onlyPriority
        );

        setTimeout(
            function () {
                this.setState((prevState) => {
                    return {
                        perm: newQuestion.perm,
                        answer: newQuestion.answer,
                        answerCategory: newQuestion.answerCategory,
                        question: newQuestion.question,
                        questionCategory: newQuestion.questionCategory,
                        chosenCharacter: newQuestion.chosenCharacter,
                        idkDisabled: false,
                        result: "",
                        answerInput: "",
                        qNum: prevState.qNum + 1,
                        showInput: false,
                        submitDisabled: false,
                        showHint: false,
                        showAnswer: false,
                    };
                });
            }.bind(this),
            2000
        );
    };

    onFinishTest = () => {
        let answerInput = document.getElementById("answer-input");
        let secondaryInput = document.getElementById("secondary-input");

        if (answerInput !== null) {
            answerInput.blur();
        }

        if (secondaryInput !== null) {
            secondaryInput.blur();
        }

        let idkCounts = testLogic.Counter(this.state.idkList);
        let wordScores = [];
        let sendScores = [];
        let sentenceWords = [];
        this.state.testSet.forEach((word) => {
            let count = idkCounts[word[this.state.charSet]] || 0;
            if (count > 4) {
                count = 4;
            }

            let scoreDict = {
                0: "Very Strong",
                1: "Strong",
                2: "Average",
                3: "Weak",
                4: "Very Weak",
            };
            if (count === 0 && word.bank === 1) {
                sentenceWords.push(word);
            }

            wordScores.push({
                char: word[this.state.charSet],
                score: scoreDict[count],
            });

            sendScores.push({
                word_id: word.id,
                score: 4 - count,
            });
        });

        if (!this.props.isDemo) {
            this.onSendScores(sendScores);
        }

        this.setState({
            testFinished: true,
            scoreList: wordScores,
            sentenceWords: sentenceWords,
        });
    };

    onSendScores = (testResults) => {
        fetch("/api/finish-test", {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({
                scores: testResults,
            }),
            cache: "no-cache",
            headers: new Headers({
                "content-type": "application/json",
                "x-access-token": this.props.token,
            }),
        }).catch(function (error) {
            console.log("Fetch error: " + error);
        });
    };

    onClickAddWords = () => {
        this.props.history.push("/add-words");
    };

    onFocusEntry = (e) => {
        e.preventDefault();
        e.stopPropagation();
        let topVal = document.getElementById("q-phrase-box").offsetTop;
        window.scrollTo(0, topVal - 5);
    };

    onHomeClicked = () => {
        this.props.history.push("/");
    };

    showSentenceHint = (word) => {
        this.setState({
            synthLoading: true,
        });
        fetch(`/api/get-one-sentence/${word}`).then((res) =>
            res.json().then((data) => {
                if (this.state.useSound) {
                    this.onSpeak(data.sentence[0][0]);
                } else {
                    const pinyin = pinyinConverter(data.sentence[0][0], {
                        style: pinyinConverter.STYLE_TONE2,
                        segment: true,
                        group: true,
                    });
                    this.setState({
                        result: pinyin.join(" "),
                        showHint: true,
                        synthLoading: false,
                    });
                }
            })
        );
    };

    onHint = () => {
        if (this.state.showHint) {
            this.setState({
                result: "",
                showHint: false,
            });
            return;
        }

        let hint = "";

        if (this.state.answerCategory === "pinyin") {
            let hinted = this.state.answer
                .split(" ")
                .map((word) => word[0] + "__");

            hint = "Hint: " + hinted.join(" ");
            this.setState({
                result: hint,
                showHint: true,
            });
        } else if (this.state.answerCategory === "meaning") {
            this.showSentenceHint(this.state.chosenCharacter);
        } else if (this.state.answerCategory === 'character') {
            this.state.writer.showOutline();

            setTimeout(() => {
                this.state.writer.hideOutline();
            }, 500);
        }
    };

    onToggleShowPinyin = () => {
        if (this.state.questionCategory === "pinyin") {
            this.setState((prevState) => ({
                showQuestionPinyin: !prevState.showQuestionPinyin,
            }));
        }
    };

    onShowAnswer = () => {
        this.setState({
            result: `Answer was: '${this.state.answer.join(" / ")}'`,
            showAnswer: true,
        });
    };

    showCharacter = () => {
        this.setState((prevState) => ({
            result:
                prevState.result === this.state.chosenCharacter
                    ? ""
                    : this.state.chosenCharacter,
        }));
    };

    render() {
        const progressNum =
            Math.floor(
                (this.state.permList.length / this.state.initNumPerms) * 100
            ) || 0;

        const textInput = (
            <Input
                id="answer-input"
                keyPressed={this.onKeyPress}
                value={this.state.answerInput}
                changed={this.onInputChanged}
                focussed={this.onFocusEntry}
                autoFocus={true}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
            />
        );

        const buttonStyle = {
            display: "inline-block",
            width: "50px",
            height: "50px",
            margin: "10px 20px",
        };

        const activeButtonStyle = {
            display: "inline-block",
            width: "50px",
            height: "50px",
            margin: "10px 20px",
            boxShadow: "0px 0px",
            transform: "translateY(3px)",
        };

        const showAnswer = this.state.showAnswer ? (
            <div>
                <PictureButton
                    style={
                        this.state.yesClicked ? activeButtonStyle : buttonStyle
                    }
                    clicked={this.onCorrectAnswer}
                    src={likePic}
                >
                    Yes
                </PictureButton>
                <PictureButton
                    style={
                        this.state.noClicked ? activeButtonStyle : buttonStyle
                    }
                    clicked={() => {
                        if (this.state.useSound) {
                            fail.play();
                        }
                        this.onIDontKnow();
                    }}
                    src={dislikePic}
                >
                    No
                </PictureButton>
            </div>
        ) : (
            <Button
                style={{ width: "230px", margin: "0 auto" }}
                clicked={this.onShowAnswer}
            >
                Show Answer
            </Button>
        );

        const characterInput = (
            <div
                id="character-target-div"
                style={{
                    backgroundColor: "lightgray",
                    width: "150px",
                    margin: "0 auto",
                    borderRadius: "3px",
                }}
            ></div>
        );

        const micInput = (
            <div>
                <PictureButton
                    colour="yellow"
                    src={micPic}
                    clicked={() => this.onListen()}
                />
                <Toggle
                    checked={this.state.useAutoRecord}
                    changed={(event) => {
                        this.state.recognition &&
                            this.state.recognition.abort();
                        this.setState({
                            useAutoRecord: event.target.checked,
                        });
                        if (event.target.checked) {
                            this.onListen();
                        }
                    }}
                />
                {this.state.showInput ? (
                    <Input
                        id="secondary-input"
                        keyPressed={this.onKeyPress}
                        value={this.state.answerInput}
                        changed={this.onInputChanged}
                        placeholder="Type answer..."
                        autoFocus={true}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                    />
                ) : null}
            </div>
        );

        let inputFormat;
        let verb;

        switch (this.state.answerCategory) {
            case "pinyin":
                if (this.state.useChineseSpeechRecognition) {
                    inputFormat = micInput;
                    verb = "Speak the ";
                } else {
                    inputFormat = textInput;
                    verb = "Enter the ";
                }
                break;
            case "character":
                inputFormat = characterInput;
                verb = "Draw the ";
                break;
            case "meaning":
                if (this.state.useFlashcards) {
                    inputFormat = showAnswer;
                    verb = "What is the ";
                } else if (this.state.useEnglishSpeechRecognition) {
                    inputFormat = micInput;
                    verb = "Speak the ";
                } else {
                    inputFormat = textInput;
                    verb = "Enter the ";
                }
                break;
            default:
                inputFormat = textInput;
                verb = "Enter the ";
        }

        const questionText =
            this.state.questionCategory === "meaning"
                ? this.state.question.join(" / ")
                : this.state.question;

        let questionFormat = <h2>{questionText}</h2>;

        if (
            this.state.questionCategory === "pinyin" &&
            this.state.useSound &&
            !this.state.showPinyin
        ) {
            questionFormat = (
                <Aux>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            overflow: "hidden",
                            height: "100px",
                        }}
                    >
                        {this.state.synthLoading ? (
                            <Spinner
                                style={{ overflow: "hidden", margin: "0 auto" }}
                            />
                        ) : (
                            <PictureButton
                                colour="grey"
                                src={speakerPic}
                                clicked={() =>
                                    this.onSpeak(this.state.chosenCharacter)
                                }
                            />
                        )}
                    </div>
                    {this.state.showQuestionPinyin ? (
                        <p style={{ color: "black" }}>{this.state.question}</p>
                    ) : null}
                    <button
                        onClick={this.onToggleShowPinyin}
                        className={classes.PinyinToggle}
                    >
                        {this.state.showQuestionPinyin
                            ? "Hide Pinyin"
                            : "Show Pinyin"}
                    </button>
                </Aux>
            );
        }

        const pinyinQuestionWithSound =
            this.state.questionCategory === "pinyin" && this.state.useSound;
        const pinyinAnswerMeaningQuestion =
            this.state.answerCategory === "pinyin" &&
            this.state.questionCategory === "meaning";
        const meaningAnswer = this.state.answerCategory === "meaning";

        if (this.state.testSet.length !== 0 || this.props.isDemo) {
            return (
                <Aux>
                    <Backdrop show={this.state.testFinished} />
                    <Modal
                        show={this.state.testFinished}
                        style={{
                            backgroundColor: "rgb(82, 129, 122)",
                            top: "20%",
                        }}
                    >
                        <TestSummary
                            isDemo={this.props.isDemo}
                            homeClicked={this.onHomeClicked}
                            continueAvailable={
                                (this.state.sentenceWords.length > 0 &&
                                    !this.props.finalStage) ||
                                this.props.isDemo
                            }
                            continueClicked={() =>
                                this.props.startSentenceRead(
                                    this.state.sentenceWords
                                )
                            }
                            scores={this.state.scoreList}
                        />
                    </Modal>
                    <div className={classes.Test}>
                        <ProgressBar progress={progressNum} />
                        <h3 id="q-phrase-box">
                            {verb}
                            <span>{this.state.answerCategory}</span> for...
                        </h3>
                        <div className={classes.QuestionCard}>
                            {questionFormat}
                        </div>
                        <p className={classes.Result}>{this.state.result}</p>
                        <div className={classes.InputDiv}>{inputFormat}</div>
                        <div
                            style={{
                                paddingTop: "30px",
                                display: "flex",
                                justifyContent: "center",
                            }}
                        >
                            <Button
                                disabled={
                                    this.state.idkDisabled ||
                                    this.state.showAnswer
                                }
                                clicked={this.onIDontKnow}
                                id="idk"
                            >
                                I Don't Know
                            </Button>
                            <Button
                                disabled={
                                    (!pinyinQuestionWithSound &&
                                        !pinyinAnswerMeaningQuestion &&
                                        !meaningAnswer &&
                                        this.state.answerCategory !== 'character') ||
                                    this.state.showAnswer
                                }
                                clicked={this.onHint}
                            >
                                {this.state.questionCategory === "pinyin" &&
                                this.state.useSound
                                    ? "Hint"
                                    : this.state.showHint
                                    ? "Hide Hint"
                                    : "Show Hint"}
                            </Button>
                            {this.state.questionCategory === "pinyin" &&
                            this.state.useSound &&
                            this.state.chosenCharacter.length === 1 ? (
                                <Button clicked={this.showCharacter}>
                                    {this.state.result ===
                                    this.state.chosenCharacter
                                        ? "Hide Character"
                                        : "Show Character"}
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </Aux>
            );
        } else {
            return (
                <Modal show={this.state.showErrorMessage}>
                    <p>You have no words due for testing!</p>
                    <Button clicked={this.onClickAddWords}>Add Words</Button>
                </Modal>
            );
        }
    }
}

const mapStateToProps = (state) => {
    return {
        token: state.auth.token,
        speechAvailable: state.settings.speechAvailable,
        synthAvailable: state.settings.synthAvailable,
        voice: state.settings.voice,
        lang: state.settings.lang,
    };
};

export default withRouter(connect(mapStateToProps)(Test));
