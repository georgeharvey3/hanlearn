import React from 'react';

import classes from './Table.module.css';

const table = props => {
    let headings = props.headings.map(heading => {
        if (heading === 'Due Date (D/M/Y)') {
            return (
                <th className="Disappear" key={heading}>{heading}</th>
            );
        }
        return (
            <th key={heading}>{heading}</th>
        );
    });
    return (
        <div className={classes.TableBox}>
            <table className={classes.Table}>
                <thead>
                    <tr>
                        {headings}
                    </tr>
                </thead>
                <tbody>
                    {props.children}
                </tbody>
            </table>
        </div>
    )
}

export default table;