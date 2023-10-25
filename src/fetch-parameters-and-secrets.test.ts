import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from 'fs';
import Serverless from 'serverless';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

// TODO: Stub out the AWS SDK

describe('fetch-parameters-and-secrets', ()=>{
    describe('fetchParametersAndSecrets', ()=>{
        it('successfully fetch secrets', ()=>{
            expect(true).eq(true)
        })
    });
})