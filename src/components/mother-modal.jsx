
import React, { Component } from 'react';
import Modal from './modal.jsx';

import produce from 'immer';

export default class MotherModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: {

      },
      errorMessage: '',
      loading: false,
    };
  }
  componentDidMount() {

  }
  static getDerivedStateFromProps(props, state) {
    if (props.showModal !== state.showModal) {
      let newState = {showModal: props.showModal};
      if (props.showModal) {
        newState.data = props.currentItem;
      }
      return newState;
    }
    return null;
  }
  submitModal(e) {
    // status 2 = screening incomplete, 1 = screening failure
    // screening true = screen now, false = screen later

    this.setState({
      loading: true
    })

    this.props.submitModal(this.state.data);
    this.props.closeModal();
  }
  handleChange(e) {
    const name = e.target.name;
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

    this.setState(
      produce(draft => {
        draft.data[name] = value;
      })
    )
  }
  handleChangeType(e) {
    const name = e.target.name;
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

    this.setState(
      produce(draft => {
        draft.data[name] = value;
        if (value === 'binary') {
          draft.data.values = [true, false]
        } else {
          draft.data.values = [false]
        }
      })
    )
  }
  addValue(e) {
    this.setState(
      produce(draft => {
        draft.data.values.splice(draft.data.values.length-1, 0, draft.data.value);
        draft.data.value = '';
      })
    )
  }
  deleteValue(idx, e) {
    this.setState(
      produce(draft => {
        draft.data.values.splice(idx, 1);
      })
    )
  }
  render() {
    var that = this;

    return <Modal active={this.props.showModal} title={this.props.title} close={this.props.closeModal}>
      <div>
        <div className="field">
          <label className="label">Label name</label>
          <div className="control">
            <input key={this.props.showModal} name="name" className="input" type="text" placeholder="Enter label" value={this.state.data.name} onChange={this.handleChange.bind(this)} />
          </div>
        </div>
        <div className="field">
          <label className="label">Type</label>
          <div className="control">
            <label className="radio">
              <input type="radio" name="type" value={'binary'} checked={this.state.data.type === 'binary'} onChange={this.handleChangeType.bind(this)} />
              Binary
            </label>
            <label className="radio">
              <input type="radio" name="type" value={'multi'} checked={this.state.data.type === 'multi'} onChange={this.handleChangeType.bind(this)} />
              Multi
            </label>
          </div>
        </div>

        {this.state.data.type === 'binary' && <div>
          <div className="field">
            <div className="control">
              <button className="button is-small is-static">Start</button>
            </div>
          </div>
          <div className="field">
            <div className="control">
              <button className="button is-small is-static">End</button>
            </div>
          </div>
        </div>}        
        
        {this.state.data.type === 'multi' && <div>
          {(this.state.data.values || []).map((item,index) => {
            var val = item;
            if (item === false) {
              val = 'End'
            } else if (item === true) {
              val = 'Start'
            }
            return <div className="field has-addons">
              <div className="control">
                <button className="button is-small is-static">{val}</button>
              </div>
              {item !== false && <div className="control">
                <button className="button is-small" onClick={this.deleteValue.bind(this,index)}>Del</button>
              </div>}
            </div>
          })}
          <div className="field has-addons">
            <div className="control">
              <input name="value" className="input" type="text" placeholder="Add value" value={this.state.data.value} onChange={this.handleChange.bind(this)} />
            </div>
            <div className="control">
              <button className="button" onClick={this.addValue.bind(this)}>Add</button>
            </div>
          </div>
        </div>}
      </div>

      <div>

        <div className="field is-grouped is-grouped-right">
          <p className="control">
            <button className="button is-success" onClick={this.submitModal.bind(this)}>
              <span className="icon">
                <i className="fas fa-check"></i>
              </span>
              <span>Save</span>
            </button>
          </p>
        </div>

      </div>

    </Modal>

  }
}