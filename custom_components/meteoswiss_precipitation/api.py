"""API endpoints for MeteoSwiss Precipitation Radar."""
import logging
import aiohttp
from aiohttp import web
from homeassistant.components.http import HomeAssistantView

_LOGGER = logging.getLogger(__name__)

METEOSWISS_BASE_URL = "https://www.meteoswiss.admin.ch/product/output"


class MeteoSwissRadarView(HomeAssistantView):
    """Handle MeteoSwiss radar data requests."""

    url = "/api/meteoswiss/{path:.*}"
    name = "api:meteoswiss"
    requires_auth = False  # The card is public, so the API should be too

    async def get(self, request: web.Request, path: str) -> web.Response:
        """Proxy GET requests to MeteoSwiss API."""
        try:
            # Construct the full MeteoSwiss URL
            meteoswiss_url = f"{METEOSWISS_BASE_URL}/{path}"

            # Add query parameters if present
            query_string = request.query_string
            if query_string:
                meteoswiss_url = f"{meteoswiss_url}?{query_string}"

            _LOGGER.debug(f"Proxying request to: {meteoswiss_url}")

            # Fetch data from MeteoSwiss
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    meteoswiss_url,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status != 200:
                        _LOGGER.error(
                            f"MeteoSwiss API error: {response.status} for {meteoswiss_url}"
                        )
                        return web.Response(
                            status=response.status,
                            text=f"MeteoSwiss API returned {response.status}"
                        )

                    # Get content type
                    content_type = response.headers.get('Content-Type', 'application/json')

                    # Read response data
                    data = await response.read()

                    # Return proxied response
                    return web.Response(
                        body=data,
                        status=200,
                        content_type=content_type,
                        headers={
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type',
                            'Cache-Control': 'max-age=300',  # Cache for 5 minutes
                        }
                    )

        except aiohttp.ClientError as err:
            _LOGGER.error(f"Error fetching from MeteoSwiss: {err}")
            return web.Response(
                status=502,
                text=f"Error connecting to MeteoSwiss: {str(err)}"
            )
        except Exception as err:
            _LOGGER.exception(f"Unexpected error in MeteoSwiss proxy: {err}")
            return web.Response(
                status=500,
                text=f"Internal server error: {str(err)}"
            )

    async def options(self, request: web.Request, path: str) -> web.Response:
        """Handle CORS preflight requests."""
        return web.Response(
            status=200,
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        )
