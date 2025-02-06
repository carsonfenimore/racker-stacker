interface EquipmentConfig{
  hostname?: string;
  entity?: string;
  model: string;
  position_topu?: number;
}


export interface RackerEquipmentModel {
  rack_u: number;
  width_inches: number;
  img_type?: string; // assumes jpg by default
}

export interface RackerConfig {
  name?: string;
  facing?: string;  // "front" (default) or "rear"
  equipment?: EquipmentConfig[];
}


