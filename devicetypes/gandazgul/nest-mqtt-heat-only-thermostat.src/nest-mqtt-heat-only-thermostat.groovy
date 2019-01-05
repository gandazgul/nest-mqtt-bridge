/**
 *  MQTT Heat Only Thermostat
 *
 *  Copyright 2017 Carlos Ravelo
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 *
 */
import groovy.transform.Field

// enummap
@Field final Map      MODE = [
    OFF:   "off",
    HEAT:  "heat"
]

@Field final Map      OP_STATE = [
    HEATING:   "heating",
    PEND_HEAT: "pending heat",
    IDLE:      "idle"
]

@Field List SUPPORTED_MODES = [MODE.OFF, MODE.HEAT]

// defaults
@Field final String   DEFAULT_MODE = MODE.OFF
@Field final String   DEFAULT_OP_STATE = OP_STATE.IDLE
@Field final String   DEFAULT_PREVIOUS_STATE = OP_STATE.HEATING
@Field final Integer  DEFAULT_TEMPERATURE = 72
@Field final Integer  DEFAULT_HEATING_SETPOINT = 68
@Field final Integer  DEFAULT_THERMOSTAT_SETPOINT = DEFAULT_HEATING_SETPOINT
@Field final Integer  DEFAULT_HUMIDITY = 52

metadata {
    // Automatically generated. Make future change here.
    definition (name: "Nest MQTT Heat Only Thermostat", namespace: "gandazgul", author: "Carlos Ravelo") {
        capability "Sensor"
        capability "Actuator"
        capability "Health Check"

        capability "Thermostat"
        capability "Temperature Measurement"
        capability "Relative Humidity Measurement"
        capability "Configuration"
        capability "Refresh"

        command "heatUp"
        command "heatDown"

        command "cycleMode"

        command "setTemperature", ["number"]
        command "setHumidityPercent", ["number"]

        command "markDeviceOnline"
        command "markDeviceOffline"

        command "setStatus"
    }

    tiles(scale: 2) {
        multiAttributeTile(name:"thermostatMulti", type:"thermostat", width:6, height:4) {
            tileAttribute("device.temperature", key: "PRIMARY_CONTROL") {
                attributeState("temp", label:'${currentValue}°', unit:"°F", defaultState: true)
            }
            tileAttribute("device.temperature", key: "VALUE_CONTROL") {
                attributeState("VALUE_UP", action: "heatUp")
                attributeState("VALUE_DOWN", action: "heatDown")
            }
            tileAttribute("device.humidity", key: "SECONDARY_CONTROL") {
                attributeState("humidity", label: '${currentValue}%', unit: "%", defaultState: true)
            }
            tileAttribute("device.thermostatOperatingState", key: "OPERATING_STATE") {
                attributeState("idle", backgroundColor: "#9a9a9a")
                attributeState("heating", backgroundColor: "#E86D13")
            }
            tileAttribute("device.thermostatMode", key: "THERMOSTAT_MODE") {
                attributeState("off",  label: '${name}')
                attributeState("heat", label: '${name}')
            }
            tileAttribute("device.heatingSetpoint", key: "HEATING_SETPOINT") {
                attributeState("default", label: '${currentValue}', unit: "°F", defaultState: true)
            }
        }

        standardTile("mode", "device.thermostatMode", width: 2, height: 2, decoration: "flat") {
            state "off",            action: "cycleMode", nextState: "updating", icon: "st.thermostat.heating-cooling-off", backgroundColor: "#CCCCCC", defaultState: true
            state "heat",           action: "cycleMode", nextState: "updating", icon: "st.thermostat.heat"
            state "updating", label: "Working"
        }

        valueTile("heatingSetpoint", "device.heatingSetpoint", width: 2, height: 2, decoration: "flat") {
            state "heat", label:'Heat\n${currentValue}°', unit: "°F", backgroundColor:"#E86D13"
        }
        standardTile("heatDown", "device.temperature", width: 1, height: 1, decoration: "flat") {
            state "default", label: "heat", action: "heatDown", icon: "st.thermostat.thermostat-down"
        }
        standardTile("heatUp", "device.temperature", width: 1, height: 1, decoration: "flat") {
            state "default", label: "heat", action: "heatUp", icon: "st.thermostat.thermostat-up"
        }

        valueTile("roomTemp", "device.temperature", width: 2, height: 1, decoration: "flat") {
            state "default", label:'${currentValue}°', unit: "°F", backgroundColors: [
                // Celsius Color Range
                [value:  0, color: "#153591"],
                [value:  7, color: "#1E9CBB"],
                [value: 15, color: "#90D2A7"],
                [value: 23, color: "#44B621"],
                [value: 29, color: "#F1D801"],
                [value: 33, color: "#D04E00"],
                [value: 36, color: "#BC2323"],
                // Fahrenheit Color Range
                [value: 40, color: "#153591"],
                [value: 44, color: "#1E9CBB"],
                [value: 59, color: "#90D2A7"],
                [value: 74, color: "#44B621"],
                [value: 84, color: "#F1D801"],
                [value: 92, color: "#D04E00"],
                [value: 96, color: "#BC2323"]
            ]
        }

        standardTile("refresh", "device.switch", inactiveLabel: false, decoration: "flat", width: 2, height: 2) {
            state "default", label: "", action: "refresh", icon: "st.secondary.refresh"
        }

        valueTile("deviceHealth", "device.healthStatus", decoration: "flat", width: 2, height: 2, inactiveLabel: false) {
            state "online",  label: "ONLINE", backgroundColor: "#00A0DC", icon: "st.Health & Wellness.health9", defaultState: true
            state "offline", label: "OFFLINE", backgroundColor: "#E86D13", icon: "st.Health & Wellness.health9"
        }

        valueTile("blank2x1", "device.switch", width: 2, height: 1, decoration: "flat") {
            state "default", label: ""
        }

        main("roomTemp")
        details(["thermostatMulti",
            "heatDown", "heatUp",
            "blank2x1", "blank2x1",
            "heatingSetpoint",
            "mode",
            "deviceHealth", "refresh"
        ])
    }

    preferences {
        input("MIN_SETPOINT", "number",
            title: "Min Temperature Setpoint",
            displayDuringSetup: true,
            defaultValue: 60
        )
        input("MAX_SETPOINT", "number",
            title: "Max Temperature Setpoint",
            displayDuringSetup: true,
            defaultValue: 80
        )
    }
}

def installed() {
    log.trace "Executing 'installed'"
    configure()
    done()
}

def updated() {
    log.trace "Executing 'updated'"
    initialize()
    done()
}

def configure() {
    log.trace "Executing 'configure'"
    // this would be for a physical device when it gets a handler assigned to it

    // for HealthCheck
    sendEvent(name: "DeviceWatch-Enroll", value: [protocol: "cloud", scheme:"untracked"].encodeAsJson(), displayed: false)
    markDeviceOnline()

    initialize()
    done()
}

def markDeviceOnline() {
    setDeviceHealth("online")
}

def markDeviceOffline() {
    setDeviceHealth("offline")
}

private setDeviceHealth(String healthState) {
    log.debug("healthStatus: ${device.currentValue('healthStatus')}; DeviceWatch-DeviceStatus: ${device.currentValue('DeviceWatch-DeviceStatus')}")
    // ensure healthState is valid
    List validHealthStates = ["online", "offline"]
    healthState = validHealthStates.contains(healthState) ? healthState : device.currentValue("healthStatus")
    // set the healthState
    sendEvent(name: "DeviceWatch-DeviceStatus", value: healthState)
    sendEvent(name: "healthStatus", value: healthState)
}

private initialize() {
    log.trace "Executing 'initialize'"

    sendEvent(name: "temperature", value: DEFAULT_TEMPERATURE, unit: "°F")
    sendEvent(name: "humidity", value: DEFAULT_HUMIDITY, unit: "%")
    sendEvent(name: "heatingSetpoint", value: DEFAULT_HEATING_SETPOINT, unit: "°F")
    sendEvent(name: "heatingSetpointMin", value: MIN_SETPOINT, unit: "°F")
    sendEvent(name: "heatingSetpointMax", value: MAX_SETPOINT, unit: "°F")
    sendEvent(name: "thermostatSetpoint", value: DEFAULT_THERMOSTAT_SETPOINT, unit: "°F")
    sendEvent(name: "thermostatMode", value: DEFAULT_MODE)
    sendEvent(name: "thermostatOperatingState", value: DEFAULT_OP_STATE)

    state.isHvacRunning = false
    state.lastOperatingState = DEFAULT_OP_STATE
    state.lastUserSetpointMode = DEFAULT_PREVIOUS_STATE
    unschedule()
}

// parse events into attributes
def parse(String description) {
    log.trace "Executing parse $description"
    def parsedEvents
    def pair = description?.split(":")
    if (!pair || pair.length < 2) {
        log.warn "parse() could not extract an event name and value from '$description'"
    } else {
        String name = pair[0]?.trim()
        if (name) {
            name = name.replaceAll(~/\W/, "_").replaceAll(~/_{2,}?/, "_")
        }
        parsedEvents = createEvent(name: name, value: pair[1]?.trim())
    }
    done()
    return parsedEvents
}

def refresh() {
    log.trace "Executing refresh"
    sendEvent(name: "thermostatMode", value: getThermostatMode())
    sendEvent(name: "thermostatOperatingState", value: getOperatingState())
    sendEvent(name: "thermostatSetpoint", value: getThermostatSetpoint(), unit: "°F")
    sendEvent(name: "heatingSetpoint", value: getHeatingSetpoint(), unit: "°F")
    sendEvent(name: "temperature", value: getTemperature(), unit: "°F")
    sendEvent(name: "humidity", value: getHumidityPercent(), unit: "%")
    done()
}

// Thermostat mode
private String getThermostatMode() {
    return device.currentValue("thermostatMode") ?: DEFAULT_MODE
}

def setThermostatMode(String value) {
    log.trace "Executing 'setThermostatMode' $value"
    if (value in SUPPORTED_MODES) {
        proposeHeatSetpoint(getHeatingSetpoint())
        sendEvent(name: "thermostatMode", value: value)
    }
    else {
        log.warn "'$value' is not a supported mode. Please set one of ${SUPPORTED_MODES.join(', ')}"
    }

    done()
}

private String cycleMode() {
    log.trace "Executing 'cycleMode'"
    String nextMode = nextListElement(SUPPORTED_MODES, getThermostatMode())
    setThermostatMode(nextMode)
    done()
    return nextMode
}

private Boolean isThermostatOff() {
    return getThermostatMode() == MODE.OFF
}

private String nextListElement(List uniqueList, currentElt) {
    if (uniqueList != uniqueList.unique().asList()) {
        throw InvalidPararmeterException("Each element of the List argument must be unique.")
    } else if (!(currentElt in uniqueList)) {
        throw InvalidParameterException("currentElt '$currentElt' must be a member element in List uniqueList, but was not found.")
    }
    Integer listIdxMax = uniqueList.size() -1
    Integer currentEltIdx = uniqueList.indexOf(currentElt)
    Integer nextEltIdx = currentEltIdx < listIdxMax ? ++currentEltIdx : 0
    String nextElt = uniqueList[nextEltIdx] as String
    return nextElt
}

// operating state
private String getOperatingState() {
    String operatingState = device.currentValue("thermostatOperatingState")?:OP_STATE.IDLE
    return operatingState
}

private setOperatingState(String operatingState) {
    if (operatingState in OP_STATE.values()) {
        sendEvent(name: "thermostatOperatingState", value: operatingState)
        if (operatingState != OP_STATE.IDLE) {
            state.lastOperatingState = operatingState
        }
    } else {
        log.warn "'$operatingState' is not a supported operating state. Please set one of ${OP_STATE.values().join(', ')}"
    }
}

// setpoint
/**
 * Ensure an integer value is within the provided range, or set it to either extent if it is outside the range.
 * @param Number value         The integer to evaluate
 * @param IntRange theRange     The range within which the value must fall
 * @return Integer
 */
private Integer boundInt(Number value, IntRange theRange) {
    value = Math.max(theRange.getFrom(), Math.min(theRange.getTo(), value))

    return value.toInteger()
}

private proposeHeatSetpoint(Integer heatSetpoint) {
    Integer newHeatSetpoint;
    IntRange HEATING_SETPOINT_RANGE = (MIN_SETPOINT.toInteger()..MAX_SETPOINT.toInteger());

    newHeatSetpoint = boundInt(heatSetpoint, HEATING_SETPOINT_RANGE)

    if (newHeatSetpoint != heatSetpoint) {
        log.warn "proposed heat setpoint $heatSetpoint is out of bounds. Modifying..."
    }

    log.info "Setting heating setpoint of $newHeatSetpoint"
    sendEvent(name: "heatingSetpoint", value: newHeatSetpoint, unit: "F")
}

private Integer getHeatingSetpoint() {
    def hs = device.currentState("heatingSetpoint")

    return hs ? hs.getIntegerValue() : DEFAULT_HEATING_SETPOINT
}

private heatUp() {
    log.trace "Executing 'heatUp'"
    def newHsp = getHeatingSetpoint() + 1

    proposeHeatSetpoint(newHsp)

    done()
}

private heatDown() {
    log.trace "Executing 'heatDown'"
    def newHsp = getHeatingSetpoint() - 1

    proposeHeatSetpoint(newHsp)

    done()
}

// temperature
private Integer getTemperature() {
    def ts = device.currentState("temperature")
    Integer currentTemp = DEFAULT_TEMPERATURE
    try {
        currentTemp = ts.integerValue
    } catch (all) {
        log.warn "Encountered an error getting Integer value of temperature state. Value is '$ts.stringValue'. Reverting to default of $DEFAULT_TEMPERATURE"
        setTemperature(DEFAULT_TEMPERATURE)
    }
    return currentTemp
}

private setTemperature(newTemp) {
    sendEvent(name:"temperature", value: newTemp)
}

// humidity
private setHumidityPercent(Integer humidityValue) {
    log.trace "Executing 'setHumidityPercent' to $humidityValue"
    Integer curHum = device.currentValue("humidity") as Integer
    if (humidityValue != null) {
        Integer hum = boundInt(humidityValue, (0..100))
        if (hum != humidityValue) {
            log.warn "Corrrected humidity value to $hum"
            humidityValue = hum
        }
        sendEvent(name: "humidity", value: humidityValue, unit: "%")
    } else {
        log.warn "Could not set measured huimidity to $humidityValue%"
    }
}

private getHumidityPercent() {
    def hp = device.currentState("humidity")

    return hp ? hp.getIntegerValue() : DEFAULT_HUMIDITY
}

/**
 * Just mark the end of the execution in the log
 */
private void done() {
    log.trace "---- DONE ----"
}

def setStatus(type, status) {
    log.debug("Setting status ${type}: ${status}")

    if (type == "thermostatOperatingState" && status == "offline") {
        markDeviceOffline();
    }
    else {
        markDeviceOnline();
        sendEvent(name: type, value: status)
    }
}
