# Overview

This is a lovelace plugin that allows you to define rackable equipment, along with their front and rear images.  The equipment can be stacked.  

Each equipment can optionally specify its "rollup" status entity. If provided an LED is positioned alongside the equipment indicating whether the equipment is healthy or not.

Each equipment can also provide a tap action.

# Equipment Models 

The card allows you to define a rack based on a list of equipment models.  These models are defined inside the HA www directory under /racker-stacker/models/ as follows:
  - Model metadata is stored in <modelname>.json
  - Front equipment picture is in "<modelname>_front.png"
  - Rear equipment picture is in "<modelname>_rear.png"


## Meta-data 
For each model the following are supported
  - width_inches
  - rack_u

## Images
The front and rear images must be provided.  Images can be any resolution, although in practice a single u, full-width item will be 410x40px.  
Thus it is recommended your image be no larger than 410 wide and some multiple of 40px, per rack U.  If the equipment is less than a full width, that is
fine, just specify the width in inches in the model file.

# Card parameters
A racker-stacker card can specify a list of equipment in the following format:

```yaml
rack:
  name?: an optional name for your rack
  equipment:
    - hostname: switch-1-1
      entity: switch-1-1-rollup
      model: cisco_3890U
      rack_u: 48
    - hostname: server-1-1
      entity: server-1-1-rollup
      model: dell_r7625
    ... 
```

## Rollup sensors
Each equipment's "can have a status LED reflective of some rollup status. For example, a server's rollup might be good if the RAID status is good, both PDUs are good, all of the expected VMs are running, etc.  When any of these conditions is not met, the server would be shown as having a bad status.  This wouldn't be enough to indicate WHY there is a problem - just that the problem exists and should be remediated.  This is particularly helpful for monitoring large numbers of racks with lots of equipment.


