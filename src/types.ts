interface EquipmentConfig{
  hostname?: string;
  entity?: string;
  // Equipment models are put in /racker-stacker/models/<model>.json and imgs in <models>_{front|rear}.{jpg,png}
  model: string;
  position_topu?: number;
  url?: string;
  facing?: string;  // defaults to whatever the "RackerConfig" is - "front" (default) or "rear"
  x_offset_inches?: number; // how far from the left, in inches; defaults to 0
}


export interface RackerEquipmentModel {
  rack_u: number;
  width_inches: number;
  img_type?: string; // assumes jpg by default
}

// rackconfig's are put inside racker-stacker/racks
export interface RackerConfig {
  flip?: boolean;
  facing?: string;  // "front" (default) or "rear"
  rack_height?: number; // in U - defaults to 48
  equipment?: EquipmentConfig[];
}

// This is the card configured inside lovelace
export interface RackInstance {
  name?: string;
  rack: string;
  flip: boolean;
}
