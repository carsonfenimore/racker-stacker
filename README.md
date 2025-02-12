# Overview

This is a lovelace plugin for home assistant that allows you to monitor all the equipment in a rack.  Each equipment item in the rack is backed by a model. The model defines the dimensions of the equipment along with its from and rear images.  When you make a racker-stacker card with you name instances of these models, along with instance-specific sensors for tracking the health of each item.

When all equipment is healthy it is shown without any red error boxes.  ![racker stacker no errors](![alt text](https://github.com/carsonfenimore/racker-stacker/blob/main/img/racker_stacker_no_errors.jpg?raw=true)

If any equipment has an error:
  - that equipment pulses red
  - the rack containing the equipment pulses red
  - if you hover over the equipment it shows which sensor(s) are causing the error

An example is shown here: ![racker stacker errors](![alt text](https://github.com/carsonfenimore/racker-stacker/blob/main/img/racker_stacker_errors.jpg?raw=true)


# Equipment Models 

In order to define your rack you must have a model for each equipment item. Models include images and metadata about the equipment.  The filenames for each equipment is based on its model name.  The models are placed inside the HA www directory under /racker-stacker/models/ as follows:
  - Model metadata: <modelname>.json
  - Front image: "<modelname>_front.jpg"
  - Rear image: "<modelname>_rear.jpg"

Note that any image format is supported - but jpg is the default.

## Model Metadata 
For each model the json can contain the following:
  - width_inches (required) - equipment width in inches
  - rack_u (required) - equipment height in U
  - img_type (optional) - gives the image suffix of each equipment; if not provided defaults to "jpg"

## Images
The front and rear images must be provided.  Images can be any resolution, although in practice a single u, full-width item will be 410x40px.  
Thus it is recommended your image be no larger than 410 wide and some multiple of 40px, per rack U.  If the equipment is less than a full width, that is
fine, just specify the width in inches in the model file.

# Card parameters
A racker-stacker card can specify a list of equipment in the following format:

```yaml
rack:
  name?: an optional name for your rack
  facing: "rear" # optional; defaults to "front"
  rack_height: 42  # optional: defaults to 48
  equipment:
    - hostname: switch-1-1
      entity: binary_sensor.switch-1-1-rollup 
      model: cisco_3890U
      rack_u: 48
    - hostname: server-1-1
      entity: 
        - binary_sensor.server-1-1-disks-healthy
        - binary_sensor.server-1-1-power-supplies-healthy
      model: dell_r7625
    ... 
```

## Rollup sensors
In the example shown above each item can have a single sensor, or list of sensors.  If any of the sensors are not "on", an error will be shown.  Note: we only support binary sensors for now, but could easily support other sensors with a small code change.  For now, we consider the sensor entities to be "rollup" sensors - specifying whether something is wrong or not - hence binary sensors seem appropriate.




