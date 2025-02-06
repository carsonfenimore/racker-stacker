import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";
import pjson from "../package.json";
import {RackerConfig,
	RackerEquipmentModel} from "./types";

class RackerStacker extends LitElement {
  @property() _config: RackerConfig;
  @property() _hass: any;

  readonly _urlRoot = "/local/racker-stacker";

  _models = new Map<string, RackerEquipmentModel>();
  _modelErrors = new Map<string, string>();
  _entityStates = new Map<string, string>(); // entity_id -> state

  static getStubConfig() {
    return {
      name: "rack-1",
      equipment: [],
    };
  }

  set hass(hass) {
    this._hass = hass;
    this.requestUpdate();
  }

  setConfig(config: RackerConfig) {
    if (!config) {
      throw new Error("No configuration.");
    }
    config = JSON.parse(JSON.stringify(config));
    this._config = config;

  }

  async requestModel(model){
    let url = `${this._urlRoot}/models/${model}.json`;
    let resp = await fetch(url);
    if (!resp.ok){
	    console.log(`Failed to get ${url}`);
	    this._modelErrors.set(model, `Failed to load ${url}`);
	    this.requestUpdate();
	    return;
    }
    let data: RackerEquipmentModel = await resp.json();
    this._models.set(model, data);
    console.log(`Got json for ${model}: ${this._models.get(model)}`);
    // TODO: only request update if no more pending
    this.requestUpdate();
  }
  
  equipmentTemplate(eq){	
    if (!this._models.has(eq.model)){
	this._models.set(eq.model, null);
	window.setTimeout( () => { this.requestModel( eq.model ); }, 1 );
    }
    if (this._models.get(eq.model) == null){
	var msg = "Loading...";
	if (this._modelErrors.has(eq.model)){
		msg = this._modelErrors.get(eq.model);
	}
	return html`<div>${msg}</div>`;
    }

    let model = this._models.get(eq.model);
    let width_inches = model.width_inches
    const full_width = 19;
    const width_max = 410.0;
    const height_1u = 40.0;
    let width_pixels = Math.floor((width_inches / full_width) * 410.0);
    let height_pixels = Math.floor( model.rack_u * height_1u );
    let img_type = model?.img_type ? model.img_type : "jpg";
    var model_image = `${this._urlRoot}/models/${eq.model}_${this._config?.facing ? this._config.facing : "front"}.${img_type}`;

    var stateIndicator;
    if (eq.entity && this._hass){
        const state = this._hass.states[eq.entity];
        var stateStr = state ? state.state : "unavailable";
        //console.log(`Entity ${eq.entity} has state ${stateStr}`);
	var color;
	if (stateStr === 'on'){
		color = "rgba(0,255,0,0.5)";
	} else {
		// for now, only color FAILING equipment
		color = "rgba(255,0,0,0.5)";
		stateIndicator = html`
		   <div style="position: absolute; background: ${color}; z-index: 3; width: ${width_pixels}px; height: ${height_pixels}px"></div>
		`;
	}
    }
    return html`
    	<div>
	   ${stateIndicator}
	   <img src="${model_image}" alt style="filter: grayscale(1.0); display: block; width: ${width_pixels}px">
	</div>`;
  }

  rackHeader(){
	  if (this._config.name){
		  return html`<div>${this._config.name}</div>`;
	  }
  }

  render() {
    return html`
    	<div> 
	${this.rackHeader()}
	${this._config.equipment.map( (eq) => {
		return this.equipmentTemplate(eq);
	})}
	</div>`;
  }

  getCardSize() {
    return 3;
  }
}

if (!customElements.get("racker-stacker")) {
  customElements.define("racker-stacker", RackerStacker);
  console.groupCollapsed(
    `%cRACKER-STACKER ${pjson.version}  IS INSTALLED`,
    "color: green; font-weight: bold"
  );
  console.log(
    "Readme:",
    "https://github.com/carsonfenimore/racker-stacker"
  );
  console.groupEnd();
} 
