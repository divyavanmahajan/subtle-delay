unzip instantclient-basic-macos.x64-11.2.0.4.0.zip
unzip instantclient-sdk-macos.x64-11.2.0.4.0.zip
mkdir /opt/oracle
mv instantclient_11_2 /opt/oracle/instantclient
ln -s /opt/oracle/instantclient/libclntsh.dylib.11.1 /opt/oracle/instantclient/libclntsh.dylib
ln -s /opt/oracle/instantclient/libclntsh.dylib.11.1 /usr/local/lib/libclntsh.dylib
ln -s /opt/oracle/instantclient/{libclntsh.dylib.11.1,libnnz11.dylib,libociei.dylib} /usr/local/lib/
