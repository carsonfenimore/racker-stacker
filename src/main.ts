import { LitElement, html, css } from "lit";
import { property, state } from "lit/decorators.js";
import pjson from "../package.json";
import {RackerConfig,
        RackInstance,
        RackerEquipmentModel} from "./types";
import { parse as yamlParse } from "yaml";



const ALARM_FLASH_CYCLE_SECONDS = 3;

class RackerStacker extends LitElement {
  @property() _config: RackerConfig;
  @property() _rack: RackInstance;
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
  _rackError = null;
  _entityStates = new Map<string, string>(); // entity_id -> state
  _equipId = 0;
  _infoPopup = null;

  static styles = css`
	.blink_me {
		animation: blinker ${ALARM_FLASH_CYCLE_SECONDS}s ease-in-out infinite;
	}
	.rack { 
		margin: 0 auto; 
		margin-left: 0px; 
		margin-top: 15px; 
		padding: 20px; 
		padding-left: 35px; 
		padding-right: 35px; 
		background-color: grey;
	}
	.rackElIndicator {
		color: rgb(80,80,80); 
		text-align: right; 
		font-weight: 900; 
		font-size: 20px;
		position: absolute;  
	}
	.rackError {
		float: left; 
		margin: 0 auto; 
		padding: 20px; 
		padding-left: 35px; 
		margin-top: 15px; 
		padding-right: 35px;
		background-color: none;  
		top: 60px;
	}
	.rackHeader {
		-webkit-text-stroke-width: 1px; 
		-webkit-text-stroke-color: black; 
		color: white; 
		vertical-align: middle; 
		font-size: 30px; 
		font-weight: 800;
		width:460px; 
		text-align: center; 
		margin: 0 auto; 5px;
		margin-left: 0px;  
		padding: 10px; 
		border-radius: 10px; 
		background-color: grey; 
	}
	.hostnameLabelInner {
		position: absolute; 
		margin: 0 auto;
		background-color: grey;
		height: 35px;
		min-width: 60%;
		text-align: center;
		vertical-align: middle;
		border-radius: 12px;
		display: none;
	}
	.hostnameLabel { 
		border-radius: 12px; 
		position: absolute; 
		background: none; 
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 4; 
		color: white; 
		font-size: 25px; 
	}
	.infoLabel {
        position: absolute;
		border: 2px black solid;
		border-radius: 12px;
		background: white;
		z-index: 10;
		padding: 10px;
		display: none;
	}
    .equipmentTitle {
        font-weight: 800;
        font-size: 16px;
    }
	.infoLabel ul {
		margin: 5px;
	}
    .triggeredSensors {
        margin-top: 5px;
    }
	@keyframes blinker {
	  50% {
	    opacity: 0;
	  }
	  100% {
	    opacity: 0.6;
	  }
	  0% {
	    opacity: 0.6;
	  }
	}
  `;

  static getStubConfig() {
    return {
      name: "Rack 1",
      rack: "rack-model-1",
    };
  }

  set hass(hass) {
    this._hass = hass;
    this.requestUpdate();
  }

  setConfig(config: RackInstance) {
    if (!config) {
      throw new Error("No rack configuration given.");
    }
    this._rack = config;
    this.requestRackConfig();
  }

  periodicRackRequest() {
    window.setTimeout( () => {this.requestRackConfig();}, 1000 );
  }

  async requestRackConfig() {
    //console.log(`Looking up remote definition of model ${this._rack.rack}`);
    let url = `${this._urlRoot}/racks/${this._rack.rack}.yaml`;
    let resp = await fetch(url, {cache: "no-cache"});
    if (!resp.ok){
	    this._rackError = "Failed to fetch rack";
	    console.log(this._rackError);
    } else {
        this._config = yamlParse( await resp.text() ) as RackerConfig;
        this.initRackConfig();
    }
    this.periodicRackRequest();
  }

  initRackConfig(){
    this._rackU = this._config?.rack_height ? this._config?.rack_height : this._defaultRackHeight;
  }

  async requestModel(model){
    // We store models inside /local/racker-stacker/models. Each model
    // defines some common attributes for all instances of this model.  The images are
    // not stored inside the model, but alongside it 
    let url = `${this._urlRoot}/models/${model}.yaml`;
    let resp = await fetch(url, {cache: "no-cache"});
    if (!resp.ok){
	    console.log(`Failed to get model descriptor from ${url}`);
	    this._modelErrors.set(model, `Failed to load ${url}`);
	    this.requestUpdate();
	    return;
    }
    let data = yamlParse( await resp.text() ) as RackerEquipmentModel;

    this._models.set(model, data);
    //console.log(`Got json for ${model}: ${this._models.get(model)}`);
    // TODO: only request update if no more pending
    this.requestUpdate();
  }

  renderSensorList(sensors){
    var guts = sensors.map( (err) => {  
        if (err.error){
            return html`<li>${err.entity}: ${err.error}</li>`;
        } else {
            return html`<li>${err.entity}: good if ${err.op} ${err.thresh}, currently ${err.value}</li>`;
        } } );
    return html`<ul>${guts}</ul>`;
  }

  renderSensorBlock(sensors, label, divClass){
    var errorGuts;
    if (sensors.length){
        errorGuts = this.renderSensorList(sensors);
    } else {
        errorGuts = html`<div>(None)</div>`;
    }
    return html`
        <div class="${divClass}">
            <b>${label}:</b>
            ${errorGuts}
        </div>`;
  }

  
  equipmentTemplate(eq){	
    const lineHeight = 35;
    // We track equipIds to give us a nice identifier for the DOM elements
    const equipId = this._equipId + 1;
    this._equipId = equipId;

    // Lets fetch the model asynchronously - we will show "Loading..." on each equipment until this returns
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

    // If the model is already fetched, go ahead and show it
    let model = this._models.get(eq.model);
    let width_pixels = Math.floor((model.width_inches / this._rackWidthInches) * this._pixelsRackWidthMax);
    let height_pixels = Math.floor( model.rack_u * this._pixelsPerU );
    let img_type = model?.img_type ? model.img_type : "jpg";
    var facing = this._config?.facing ? this._config.facing : "front";
    if (eq.facing){
        facing = eq.facing;
    }
    // we allow a rack to be flipped from its definition, allowing one define the rack once, 
    // and show front or rear views in the card (rather than the rack model)
    const flip = this._rack?.flip ? this._rack.flip : false;
    if (flip) {
        if (facing == "front")
            facing = "rear";
        else
            facing = "front";
    }
    var model_image = `${this._urlRoot}/models/${eq.model}_${facing}.${img_type}`;
    let posu = 55+Math.floor(this._rackU - eq.position_topu + 1)*this._pixelsPerU;
    var posleft = 35;
    if (eq.x_offset_inches){
        const widthPixelsPerInch = this._pixelsRackWidthMax / this._rackWidthInches;
        posleft += eq.x_offset_inches * widthPixelsPerInch;
    }
    var stateIndicator;
    //console.log(`On EQ ${eq.hostname}`);
    var sensors = this.evaluateSensors(this.getEquipmentSensors(eq), this._hass);

    // for now, only color FAILING equipment
    if (sensors.bad.length){
      const color = "rgba(255,0,0,0.7)";
      stateIndicator = html`
	      <div class="blink_me" style="position: absolute; background: ${color}; z-index: 3; width: ${width_pixels}px; height: ${height_pixels}px"></div>
      `;
    }

    // Show a label describing which of the sensors is erroring
    const infoPopupId = `info-${equipId}`;
    const equipLabelIdStr = `equipmentLabel-${equipId}`;
    var urlTag;
    if (eq.url){
        urlTag = html`<a target="_blank" href=${eq.url}>${eq.url}</a><br />`;
    }

    // list all bad sensors first
    var triggeredSensors = this.renderSensorBlock(sensors.bad, "Triggered Sensors", "triggeredSensors");
    var goodSensors = this.renderSensorBlock(sensors.good, "Nominal Sensors", "nominalSensors");
        
    var infoTag = html`
    <div id=${infoPopupId} class="infoLabel" @mouseleave=${ (e) => {this.infoPopupMouseLeave(eq, equipLabelIdStr, infoPopupId);}}  @mouseenter=${ (e) => {this.infoMouseEnter(eq, infoPopupId);} }  style="top: ${posu}px; width: ${this._pixelsRackWidthMax}px; left: ${width_pixels}px;">
        <div class="equipmentTitle">${eq.hostname} (${eq.model}) </div>
        ${urlTag} 
        ${triggeredSensors}
        ${goodSensors}
    </div>`;

    // Show the equipment hostname (if mouse over)
    var hostnameLabel = html`
    	<div class="hostnameLabel" @mouseenter=${ (e) => {this.hostnameLabelMouseEnter(eq, equipLabelIdStr, infoPopupId);}} @mouseleave=${ (e) => {this.hostnameLabelMouseLeave(eq, equipLabelIdStr, infoPopupId);} } style="width: ${width_pixels}px; height: ${height_pixels}px; ">
    		<div id="${equipLabelIdStr}" class="hostnameLabelInner" style="line-height: ${lineHeight}px; height: ${lineHeight}px;">${eq.hostname}</div>
	</div>`;
    return html`
    <div>
       ${infoTag}
       <div style="position: absolute;left: ${posleft}px;  top: ${posu}px; width: ${width_pixels}px; height: ${height_pixels}px; ">
	      ${stateIndicator}
	      ${hostnameLabel}
	      <img src="${model_image}" alt style="${ stateIndicator ? 'filter: grayscale(1.0)' : ''}; display: block; width: ${width_pixels}px">
	   </div>
    </div>`;
  }

  // Equipment can specify "entity" with a single item or a list - this handles either returning a list
  getEquipmentSensors(eq){
    if (!eq.entity)
        return [];
	if (typeof(eq.entity) == "string"){
		return [eq.entity];
	}
	return eq.entity;
  }    

  // Each entity is an expression: 'entity' <op> <threshold>
  // We want to determine how many sensors are erroring, and also display, to show alarms
  // We also want to show which sensors are erroring, or not, along with their threshold and current values
  // So maybe we return two maps: one error and one good. Each has items with the sensor name, threshold, and value
  evaluateSensors(sensors, hass){
    // tODO: there is some bug right now where entity MUST be defined, else model fails...
    var badSensors = [];
    var goodSensors = [];
    if (hass) {
        for (const sens of sensors){
            const tokens: string[] = sens.split(" ");
            var out = {error:null,entity:null,op:null,thresh:null,value:null};
            if (tokens.length != 3){
                out.entity = sens;
                out.error = "Incorrect format! Should be: <entity> <operator> <threshold>";
                badSensors.push( out );
            } else {
                out.entity = tokens[0];
                out.op = tokens[1];
                const haValue = hass.states[out.entity];
                if (!haValue){
                    out.error = "HA didn't provide current value! Sounds like an HA bug."
                    badSensors.push(out);
                    continue;
                } 
                out.thresh = this.parseThresh(tokens[2]);
                if (!out.thresh) {
                    out.error = `Your threshold value of "${tokens[2]}" couldn't be parsed - did you flub it?`;
                    badSensors.push(out);
                    continue;
                } 
                out.value = this.parseState(haValue.state);
                if (typeof out.value != typeof out.thresh) {
                    out.error = `Your threshold is a ${typeof out.thresh} but your state is a ${typeof out.value} - comparing them seems bogus`;
                    badSensors.push(out);
                    continue;
                } 
                const compareVal = this.compareOp(out.value, out.op, out.thresh);
                if (compareVal == null){
                    out.error = "Invalid operator; gave ${out.op}, but supported ops are: <, <=, >, >=, =, !=";
                    badSensors.push(out);
                } else {
                    if (compareVal)
                        goodSensors.push(out);
                    else {
                        badSensors.push(out);
                    }
                }
            }
        }
    }
    return {good: goodSensors, bad: badSensors};
  }

  parseThresh(thresh){
    if (thresh.charAt(0) == "'") {
        if (thresh.charAt(thresh.length-1) != "'")
            return null;
        // string
        return thresh.slice(1, thresh.length-1);
    } 
    // number - float if has ., otherwise int
    return this.parseNum(thresh);
  }

  parseNum(val){
    try {
        if (val.indexOf('.') != -1){
            val = parseFloat(val);
        } else {
            val = parseInt(val);
        }
        if (isNaN(val)){
            return null;
        }
        return val;
    } catch (error) {
            return null;
    }
  }

  parseState(state){
    var tryNum = this.parseNum(state);
    if (tryNum == null){
        return state; // string
    }
    return tryNum;
  }

  compareOp(val, op, thresh){
    if (op == '='){
        return val == thresh;
    } else if (op == '<') {
        return val < thresh;
    } else if (op == '<=') {
        return val <= thresh;
    } else if (op == '>') {
        return val > thresh;
    } else if (op == '>=') {
        return val >= thresh;
    } else if (op == '!=') {
        return val != thresh;
    } 
    return null;
  }


  infoMouseEnter(eq, infoPopupId){
    this._infoPopup = infoPopupId;
  }

  countEquipmentErrors(eq, hass) {
	  return this.evaluateSensors(this.getEquipmentSensors(eq), hass).bad.length;
  }

  hostnameLabelMouseEnter(eq, equipIdStr, infoPopupIdStr){
	  //console.log("Enter ",equipIdStr);
	  //this.shadowRoot.getElementById(equipIdStr).style.display = "block";
      this.shadowRoot.getElementById(infoPopupIdStr).style.display = "block";
  }

  infoPopupMouseLeave(eq, equipIdStr, infoPopupIdStr){
	  console.log("Leave info on ",eq.hostname);
      this._infoPopup = null;
      this.shadowRoot.getElementById(infoPopupIdStr).style.display = "none";
  }

  hostnameLabelMouseLeave(eq, equipIdStr, infoPopupIdStr){
	  //console.log("Leave ",equipIdStr);
      setTimeout( () => {
          this.shadowRoot.getElementById(equipIdStr).style.display = "none";
          if (this._infoPopup != infoPopupIdStr){
              this.shadowRoot.getElementById(infoPopupIdStr).style.display = "none";
          }
    }, 10);
  }


  rackHeader(){
	  const headerHeight = 30;

	  var name = this._rack?.name ? this._rack.name : html`&nbsp;`;
	  return html` <div class="rackHeader" style="height ${headerHeight}px; line-height: ${headerHeight}px;">
			     ${name }
			   </div>`;
  }

  renderRackAlarm(){
    if (!this._hass || !this._config)
      return;

    for (const eq of this._config.equipment){
      if (this.countEquipmentErrors(eq, this._hass)){
	    return html`
          	<div class="blink_me rackError" style=" width: ${this._pixelsRackWidthMax - this._rackAlarmBorderPixels*2}px; height: ${this._rackU*this._pixelsPerU-this._rackAlarmBorderPixels*2}px; border: ${this._rackAlarmBorderPixels}px solid rgba(255,0,0,1.0); ">
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
    			<div class="rackElIndicator" style="top: ${indicatorVerticalOffset+(racku)*this._pixelsPerU}px; left: ${indicatorOffset}px; width: ${indicatorWidth}px; height: ${this._pixelsPerU}px; ">${this._rackU - racku}</div>
    			<div class="rackElIndicator" style="top: ${indicatorVerticalOffset+(racku)*this._pixelsPerU}px; left: ${this._pixelsRackWidthMax + indicatorWidth + indicatorOffset + indicatorOffsetRight }px; width: ${indicatorWidth}px; height: ${this._pixelsPerU}px; ">${this._rackU - racku}</div>
		</div>`; 
  }

  render() {
    this._equipId = 0;
    if (!this._config){
        return html`<div>Loading...</div>`;
    }
    return html`
    	<div> 
	      ${this.rackHeader()}
	      ${this.renderRackAlarm()}
          <div class="rack" style="width: ${this._pixelsRackWidthMax}px; height: ${this._rackU*this._pixelsPerU}px;">
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
    `%cRACKER-STACKER ${pjson.version} IS INSTALLED`,
    "color: green; font-weight: bold"
  );
  console.log(
    "Readme:",
    "https://github.com/carsonfenimore/racker-stacker"
  );
  console.groupEnd();
} 
