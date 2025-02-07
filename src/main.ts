import { LitElement, html, css } from "lit";
import { property, state } from "lit/decorators.js";
import pjson from "../package.json";
import {RackerConfig,
	RackerEquipmentModel} from "./types";


const ALARM_FLASH_CYCLE_SECONDS = 3;

class RackerStacker extends LitElement {
  @property() _config: RackerConfig;
  @property() _hass: any;
  @property() _rackU: number;

  readonly _urlRoot = "/local/racker-stacker";
  readonly _pixelsPerU = 40.0;
  readonly _defaultRackHeight = 48;
  readonly _rackWidthInches = 19;
  readonly _pixelsRackWidthMax = 410.0;
  readonly _rackAlarmBorderPixels = 16;

  _models = new Map<string, RackerEquipmentModel>();
  _modelErrors = new Map<string, string>();
  _entityStates = new Map<string, string>(); // entity_id -> state

  static styles = css`
	.blink_me {
		animation: blinker ${ALARM_FLASH_CYCLE_SECONDS}s ease-in-out infinite;
	}
	@keyframes blinker {
	  50% {
	    opacity: 0;
	  }
	}
  `;

  static getStubConfig() {
    return {
      name: "Rack 1",
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

    this._rackU = config?.rack_height ? config?.rack_height : this._defaultRackHeight;
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
    let width_pixels = Math.floor((model.width_inches / this._rackWidthInches) * this._pixelsRackWidthMax);
    let height_pixels = Math.floor( model.rack_u * this._pixelsPerU );
    let img_type = model?.img_type ? model.img_type : "jpg";
    var model_image = `${this._urlRoot}/models/${eq.model}_${this._config?.facing ? this._config.facing : "front"}.${img_type}`;
    let posu = 20+Math.floor(this._rackU - eq.position_topu )*this._pixelsPerU;
    //console.log(`Pos for ${eq.hostname} is ${posu}`);
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
		   <div class="blink_me" style="position: absolute; background: ${color}; z-index: 3; width: ${width_pixels}px; height: ${height_pixels}px"></div>
		`;
	}
    }
    return html`
    	<div style="position: absolute; top: ${posu}px; width: ${width_pixels}px, height: ${height_pixels}px; left 60px;">
	   ${stateIndicator}
	   <img src="${model_image}" alt style="${ stateIndicator ? 'filter: grayscale(1.0)' : ''}; display: block; width: ${width_pixels}px">
	</div>`;
  }

  rackHeader(){
	  var head;
	  if (this._config.name){
		  head = html` <div style="position: absolute; top: 0px; left 0px;">
				  <div style="width:100%; height 120px;  text-align: center; margin-bottom: 5px;">
				   <div style="width:460px; margin: 0 auto; 5px; padding: 10px; height 120px; border-radius: 10px; background-color: grey; color: rgb(80,80,80);">
			             <span style="font-size: 20px; font-weight: 800;">${this._config.name}</span>
			   	   </div>
				</div>
			     </div>`;
	  }
	  return head;
  }

  renderRackAlarm(){
    if (!this._hass)
      return;

    for (const eq of this._config.equipment){
      if (!eq.entity)
        continue;

      const state = this._hass.states[eq.entity];
      var stateStr = state ? state.state : "unavailable";
      if (stateStr !== 'on'){
	    return html`
          	<div class="blink_me" style="position: absolute; margin: 0 auto; padding: 20px; padding-left: 35px; padding-right: 35px; width: ${this._pixelsRackWidthMax - this._rackAlarmBorderPixels*2}px; height: ${this._rackU*this._pixelsPerU-this._rackAlarmBorderPixels*2}px; background-color: none; border: ${this._rackAlarmBorderPixels}px solid rgba(255,0,0,1.0); top: 0px;">
		</div>`;
      }
    }
  }

  render() {
    
    return html`
    	<div> 
	  ${this.rackHeader()}
          
          <div style="position: absolute; top: ${this._config?.name ? 60 : 0}px; left 0px;">
          	<div style="margin: 0 auto; padding: 20px; padding-left: 35px; padding-right: 35px; width: ${this._pixelsRackWidthMax}px; height: ${this._rackU*this._pixelsPerU}px; background-color: grey;">
          		${ Array.from({length: this._rackU}, (_, i) => i).map( (racku) => {
          			return html`<div style="position: absolute;  top: ${20+(racku)*this._pixelsPerU}px; left: 5px; width: 25px; height: ${this._pixelsPerU}px; color: rgb(80,80,80); text-align: right; font-weight: 900; font-size: 20px;">${this._rackU - racku}</div>`; 
          			}) }
          		${this._config.equipment.map( (eq) => {
          			return this.equipmentTemplate(eq);
          		})}
          	</div>
		${this.renderRackAlarm()}
          </div>

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
