#!/bin/bash
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
# Go one level above to the repo.
INSTALLDIR="$( cd -P "$( dirname "$SOURCE" )"/.. && pwd )"
echo $INSTALLDIR

docker run -d -v "$INSTALLDIR:/opt/subtle-delay" collinestes/docker-node-oracle /opt/subtle-delay/bin/run-background.sh
echo Logs are in $INSTALLDIR/bin/logs
