
import React, { Component } from 'react';
export default class Modal extends React.Component {
  render() {
    return (<div className={"modal "+(this.props.active ? 'is-active' : '')}>
      <div className="modal-background" onClick={this.props.close}></div>
      <div className="modal-card" style={{width:'80%',height:'100%'}}>
        <header className="modal-card-head" style={{padding:15}}>
          <p className="modal-card-title">{this.props.title}</p>
          <button className="delete" aria-label="close" onClick={this.props.close}></button>
        </header>
        <section className="modal-card-body">
          {this.props.children[0]}
        </section>
        <footer className="modal-card-foot" style={{padding:10,justifyContent:'flex-end'}}>
          {this.props.children[1]}
        </footer>
      </div>
    </div>);
  }
}
