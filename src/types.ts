interface EquipmentConfig{
  hostname?: string;
  entity?: string;
  model: string;
  position_topu?: number;
  url?: string;
  facing?: string;  // defaults to whatever the "rRackerConfig" is - "front" (default) or "rear"
  x_offset_inches?: number; // how far from the left, in inches; defaults to 0
}


export interface RackerEquipmentModel {
  rack_u: number;
  width_inches: number;
  img_type?: string; // assumes jpg by default
}

export interface RackerConfig {
  name?: string;
  facing?: string;  // "front" (default) or "rear"
  rack_height?: number; // in U - defaults to 48
  equipment?: EquipmentConfig[];
}


