#!/bin/sh
set -e

# Las migraciones y workers son unidades de despliegue separadas. Este proceso
# inicia únicamente la aplicación web y propaga correctamente las señales.
exec npm run start
