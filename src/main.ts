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
  readonly _rackAlarmBorderPixels = 32;

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
	  100% {
	    opacity: 0.5;
	  }
	  0% {
	    opacity: 0.5;
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
    let posu = 55+Math.floor(this._rackU - eq.position_topu )*this._pixelsPerU;
    //console.log(`Pos for ${eq.hostname} is ${posu}`);
    var stateIndicator;
    if (eq.entity && this._hass){
        const state = this._hass.states[eq.entity];
        var stateStr = state ? state.state : "unavailable";
        //console.log(`Entity ${eq.entity} has state ${stateStr}`);
	var color;
	if (stateStr === 'off'){
           // for now, only color FAILING equipment
           color = "rgba(255,0,0,0.7)";
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
	  var name = this._config?.name ? this._config.name : html`&nbsp;`;
	  const headerHeight = 30;
	  return html` <div style="  -webkit-text-stroke-width: 1px; -webkit-text-stroke-color: black; color: white; vertical-align: middle; font-size: 30px; font-weight: 800;width:460px; text-align: center; margin: 0 auto; 5px;margin-left: 0px;  padding: 10px; height ${headerHeight}px; line-height: ${headerHeight}px;  border-radius: 10px; background-color: grey; ">
			     ${name }
			   </div>`;
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
          	<div class="blink_me" style="float: left; margin: 0 auto; padding: 20px; padding-left: 35px; margin-top: 15px; padding-right: 35px; width: ${this._pixelsRackWidthMax - this._rackAlarmBorderPixels*2}px; height: ${this._rackU*this._pixelsPerU-this._rackAlarmBorderPixels*2}px; background-color: none; border: ${this._rackAlarmBorderPixels}px solid rgba(255,0,0,1.0); top: 60px;">
		</div>`;
      }
    }
  }

  rackElLabel(racku) {
    const indicatorWidth = 25;
    const indicatorOffset = 5;
    const indicatorOffsetRight = 7;
    const indicatorVerticalOffset = 95;
    return html`<div>
    			<div style="position: absolute;  top: ${indicatorVerticalOffset+(racku)*this._pixelsPerU}px; left: ${indicatorOffset}px; width: ${indicatorWidth}px; height: ${this._pixelsPerU}px; color: rgb(80,80,80); text-align: right; font-weight: 900; font-size: 20px;">${this._rackU - racku}</div>
    			<div style="position: absolute;  top: ${indicatorVerticalOffset+(racku)*this._pixelsPerU}px; left: ${this._pixelsRackWidthMax + indicatorWidth + indicatorOffset + indicatorOffsetRight }px; width: ${indicatorWidth}px; height: ${this._pixelsPerU}px; color: rgb(80,80,80); text-align: right; font-weight: 900; font-size: 20px;">${this._rackU - racku}</div>
		</div>`; 
  }

  render() {
    
    return html`
    	<div> 
	  ${this.rackHeader()}
          
	  ${this.renderRackAlarm()}
          <div style="margin: 0 auto; margin-left: 0px; margin-top: 15px; padding: 20px; padding-left: 35px; padding-right: 35px; width: ${this._pixelsRackWidthMax}px; height: ${this._rackU*this._pixelsPerU}px; background-color: grey;">
          		${ Array.from({length: this._rackU}, (_, i) => i).map( (racku) => {
          			return this.rackElLabel(racku);
          			}) }
          		${this._config.equipment.map( (eq) => {
          			return this.equipmentTemplate(eq);
          		})}
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
