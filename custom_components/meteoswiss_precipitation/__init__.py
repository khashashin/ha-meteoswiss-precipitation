"""MeteoSwiss Precipitation Radar Integration.

This integration automatically sets up and includes the frontend card.
No configuration.yaml entry or manual resource registration is required!
"""
import logging
import os
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.typing import ConfigType
from homeassistant.components.frontend import add_extra_js_url

_LOGGER = logging.getLogger(__name__)

DOMAIN = "meteoswiss_precipitation"
CARD_FILENAME = "meteoswiss-radar-card.js"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the MeteoSwiss Precipitation Radar component.

    This integration auto-enables itself - no configuration required.
    It provides:
    1. Backend proxy for MeteoSwiss data at /api/meteoswiss/*
    2. Auto-registration of the frontend card
    """
    # Check if already set up
    if DOMAIN in hass.data:
        return True

    _LOGGER.info("Setting up MeteoSwiss Precipitation Radar")

    # Store data in hass.data
    hass.data[DOMAIN] = {}

    # Register API views
    from .api import MeteoSwissRadarView

    hass.http.register_view(MeteoSwissRadarView())

    # Register frontend card
    # The card file is bundled in custom_components/meteoswiss_precipitation/www/
    card_path = os.path.join(os.path.dirname(__file__), "www", CARD_FILENAME)

    if os.path.exists(card_path):
        # Register the card as a Lovelace resource
        add_extra_js_url(hass, f"/meteoswiss_precipitation/{CARD_FILENAME}")
        _LOGGER.info(f"Registered frontend card at /meteoswiss_precipitation/{CARD_FILENAME}")
    else:
        _LOGGER.warning(f"Card file not found at {card_path}")

    _LOGGER.info("MeteoSwiss Precipitation Radar setup complete")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up from a config entry (not used - integration is always on)."""
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry (not used - integration is always on)."""
    return True
