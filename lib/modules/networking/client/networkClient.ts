import * as http from 'http';
import * as https from 'https';
import { dynamic } from '../../../types/common';
import { Deferred } from '../../../utils/PromiseUtil';

import { RequestModel } from '../models/requestModel';
import { NetworkClientInterface } from './networkClientInterface';
import { ResponseModel } from '../models/responseModel';

const HTTPS = 'HTTPS';

export class NetworkClient implements NetworkClientInterface {
  GET(requestModel: RequestModel): Promise<ResponseModel> {
    const deferred = new Deferred();

    const networkOptions: Record<string, dynamic> = requestModel.getOptions();
    const responseModel = new ResponseModel();

    try {
      const httpClient = networkOptions.scheme === HTTPS ? https : http;

      const req = httpClient.get(networkOptions, res => {
        responseModel.setStatusCode(res.statusCode);
        const contentType = res.headers['content-type'];

        let error;
        let rawData = '';

        if (!/^application\/json/.test(contentType)) {
          error = `Invalid content-type.\nExpected application/json but received ${contentType}`;
        }

        if (error) {
          // console.error(error);
          // Consume response data to free up memory
          res.resume();
          responseModel.setError(error);
          deferred.reject(responseModel);
        }
        res.setEncoding('utf8');

        res.on('data', chunk => {
          rawData += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = JSON.parse(rawData);

            if (responseModel.getStatusCode() !== 200) {
              const error = `Request failed for fetching account settings. Got Status Code: ${responseModel.getStatusCode()} and message: ${rawData}`;
              // console.error(error);
              responseModel.setError(error);
              deferred.reject(responseModel);

              return;
            }
            responseModel.setData(parsedData);
            deferred.resolve(responseModel);
          } catch (err) {
            // console.log('error is ', err);
            responseModel.setError(err);
            deferred.reject(responseModel);
          }
        });
      });

      req.on('timeout', () => {
        responseModel.setError(new Error('timeout'));
        deferred.reject(responseModel);
      });
    } catch (err) {
      responseModel.setError(err);
      deferred.reject(responseModel);
    }

    return deferred.promise;
  }

  POST(request: RequestModel): Promise<ResponseModel> {
    const deferred = new Deferred();
    const networkOptions: Record<string, dynamic> = request.getOptions();
    const responseModel: ResponseModel = new ResponseModel();

    try {
      const httpClient = networkOptions.scheme === HTTPS ? https : http;
      const req = httpClient.request(networkOptions, res => {
        let rawData = ''; // eslint-disable-line no-unused-vars
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          rawData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            responseModel.setData(request.getBody());
            deferred.resolve(responseModel);
          } else if (res.statusCode === 413) {
            const parsedData = JSON.parse(rawData);
            responseModel.setError(parsedData.error);
            responseModel.setData(request.getBody());
            deferred.reject(responseModel);
          } else {
            const parsedData = JSON.parse(rawData);
            responseModel.setError(parsedData.message);
            responseModel.setData(request.getBody());
            deferred.reject(responseModel);
          }
        });
      });

      req.on('timeout', () => {
        responseModel.setError(new Error('timeout'));
        responseModel.setData(request.getBody());
        deferred.reject(responseModel);
      });

      req.write(JSON.stringify(networkOptions.body));
      req.end();
    } catch (err) {
      responseModel.setError(err);
      responseModel.setData(request.getBody());
      deferred.reject(responseModel);
    }

    return deferred.promise;
  }
}
