<?php

namespace App\Services\Sms;

interface SmsProviderInterface
{
    /**
     * @return array{status:string,external_id:?string,raw:mixed}
     */
    public function send(string $toNumber, string $body): array;
}
